import json
import os
import unittest
from unittest.mock import patch

from pydantic import BaseModel

from lead_trace_worker.model_gateway import (
    ModelGatewayConfig,
    StructuredOutputError,
    request_structured_output,
)


class _SampleSchema(BaseModel):
    value: str


class _FakeMessage:
    def __init__(self, content: str):
        self.content = content


class _FakeChoice:
    def __init__(self, content: str):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content: str):
        self.choices = [_FakeChoice(content)]


class _FakeCompletions:
    def __init__(self, contents: list[str]):
        self._contents = list(contents)
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        content = self._contents.pop(0)
        return _FakeResponse(content)


class _FakeChat:
    def __init__(self, contents: list[str]):
        self.completions = _FakeCompletions(contents)


class FakeClient:
    def __init__(self, contents: list[str]):
        self.chat = _FakeChat(contents)


class _EmptyChoicesResponse:
    def __init__(self):
        self.choices = []


class _EmptyChoicesCompletions:
    def __init__(self):
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return _EmptyChoicesResponse()


class _EmptyChoicesChat:
    def __init__(self):
        self.completions = _EmptyChoicesCompletions()


class EmptyChoicesClient:
    def __init__(self):
        self.chat = _EmptyChoicesChat()


def _config() -> ModelGatewayConfig:
    return ModelGatewayConfig(api_key='test-key', base_url='https://example.test/v1', model='qwen3-max')


class ModelGatewayConfigTest(unittest.TestCase):
    def test_from_env_raises_when_api_key_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                ModelGatewayConfig.from_env()

    def test_from_env_raises_when_api_key_blank(self):
        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': '   '}, clear=True):
            with self.assertRaises(ValueError):
                ModelGatewayConfig.from_env()

    def test_from_env_reads_values_with_defaults(self):
        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'secret'}, clear=True):
            config = ModelGatewayConfig.from_env()
            self.assertEqual(config.api_key, 'secret')
            self.assertEqual(config.base_url, 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
            self.assertEqual(config.model, 'qwen3.8-max')


class RequestStructuredOutputTest(unittest.TestCase):
    def test_valid_response_on_first_call_returns_validated_instance(self):
        client = FakeClient([json.dumps({'value': 'ok'})])
        result = request_structured_output(
            client,
            _config(),
            system_prompt='system',
            user_prompt='user',
            schema=_SampleSchema,
        )
        self.assertIsInstance(result, _SampleSchema)
        self.assertEqual(result.value, 'ok')
        self.assertEqual(len(client.chat.completions.calls), 1)

    def test_invalid_then_valid_retries_once_and_returns_second_result(self):
        client = FakeClient(['not json', json.dumps({'value': 'second'})])
        result = request_structured_output(
            client,
            _config(),
            system_prompt='system',
            user_prompt='user',
            schema=_SampleSchema,
        )
        self.assertEqual(result.value, 'second')
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_invalid_both_calls_raises_and_calls_exactly_twice(self):
        client = FakeClient(['not json', 'still not json'])
        with self.assertRaises(StructuredOutputError):
            request_structured_output(
                client,
                _config(),
                system_prompt='system',
                user_prompt='user',
                schema=_SampleSchema,
            )
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_schema_validation_failure_also_retries_once_then_raises(self):
        client = FakeClient([json.dumps({'wrong_field': 1}), json.dumps({'wrong_field': 2})])
        with self.assertRaises(StructuredOutputError):
            request_structured_output(
                client,
                _config(),
                system_prompt='system',
                user_prompt='user',
                schema=_SampleSchema,
            )
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_empty_choices_list_raises_structured_output_error_and_calls_exactly_twice(self):
        client = EmptyChoicesClient()
        with self.assertRaises(StructuredOutputError):
            request_structured_output(
                client,
                _config(),
                system_prompt='system',
                user_prompt='user',
                schema=_SampleSchema,
            )
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_none_message_content_raises_structured_output_error_and_calls_exactly_twice(self):
        client = FakeClient([None, None])
        with self.assertRaises(StructuredOutputError):
            request_structured_output(
                client,
                _config(),
                system_prompt='system',
                user_prompt='user',
                schema=_SampleSchema,
            )
        self.assertEqual(len(client.chat.completions.calls), 2)

    def test_call_shape_uses_json_object_response_format_and_message_roles(self):
        client = FakeClient([json.dumps({'value': 'ok'})])
        request_structured_output(
            client,
            _config(),
            system_prompt='system-prompt-text',
            user_prompt='user-prompt-text',
            schema=_SampleSchema,
        )
        call = client.chat.completions.calls[0]
        self.assertEqual(call['response_format'], {'type': 'json_object'})
        self.assertEqual(call['extra_body'], {'enable_thinking': False})
        messages = call['messages']
        self.assertEqual(messages[0]['role'], 'system')
        self.assertEqual(messages[0]['content'], 'system-prompt-text')
        self.assertEqual(messages[1]['role'], 'user')
        self.assertEqual(messages[1]['content'], 'user-prompt-text')


if __name__ == '__main__':
    unittest.main()
