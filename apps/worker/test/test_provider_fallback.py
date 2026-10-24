import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import BaseModel
from lead_trace_worker import llm
from lead_trace_worker.model_gateway import ModelGatewayConfig, StructuredOutputError, request_structured_output
from lead_trace_worker.providers import configured_providers
from lead_trace_worker.graph_brief import assemble_sections
from test.test_research_quality import context, evidence

ENV = {'NODE_ENV': 'production', 'GEMINI_API_KEY': 'gemini-test-secret', 'DASHSCOPE_API_KEY': 'dashscope-test-secret'}


class Schema(BaseModel):
    value: str


class FakeClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []
        self.chat = SimpleNamespace(completions=self)

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.payload, Exception):
            raise self.payload
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(self.payload)))])


class ProviderFallbackTest(unittest.TestCase):
    def test_production_prefers_gemini_but_local_never_uses_its_key(self):
        with patch.dict(os.environ, ENV, clear=True):
            self.assertEqual([p.provider for p in configured_providers()], ['gemini', 'dashscope'])
            config = ModelGatewayConfig.from_env()
            self.assertEqual(config.provider, 'gemini')
            self.assertEqual(config.fallbacks[0].provider, 'dashscope')
        with patch.dict(os.environ, {**ENV, 'NODE_ENV': 'development', 'LLM_PROVIDER_ORDER': 'dashscope'}, clear=True):
            self.assertEqual([p.provider for p in configured_providers()], ['dashscope'])
            self.assertEqual([p.provider for p in llm.resolve_llm_configs()], ['dashscope'])

    def test_missing_primary_key_skips_it_and_invalid_order_is_rejected(self):
        with patch.dict(os.environ, {**ENV, 'GEMINI_API_KEY': ''}, clear=True):
            self.assertEqual(ModelGatewayConfig.from_env().provider, 'dashscope')
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'local-key', 'LLM_PROVIDER_ORDER': 'dashscope'}, clear=True):
            self.assertFalse(llm.llm_enabled())
        for order in ('gemini,gemini', 'gemini,invalid', 'gemini,'):
            with patch.dict(os.environ, {'LLM_PROVIDER_ORDER': order}, clear=True):
                with self.assertRaisesRegex(ValueError, 'LLM_PROVIDER_ORDER'):
                    configured_providers()

    def test_gateway_network_or_quota_error_falls_back_with_correct_request_options(self):
        for error in (ConnectionError('network'), RuntimeError('quota exhausted')):
            with self.subTest(error=type(error).__name__), patch.dict(os.environ, ENV, clear=True):
                config = ModelGatewayConfig.from_env()
                primary, fallback = FakeClient(error), FakeClient({'value': 'ok'})
                result = request_structured_output(primary, config, system_prompt='system', user_prompt='user', schema=Schema, client_factory=lambda c: fallback)
                self.assertEqual(result.value, 'ok')
                self.assertEqual(len(primary.calls), 1)
                self.assertEqual(len(fallback.calls), 1)
                self.assertEqual(primary.calls[0]['reasoning_effort'], 'low')
                self.assertNotIn('extra_body', primary.calls[0])
                self.assertEqual(fallback.calls[0]['extra_body'], {'enable_thinking': False})

    def test_gateway_invalid_schema_retries_before_using_fallback(self):
        with patch.dict(os.environ, ENV, clear=True):
            primary, fallback = FakeClient({'wrong': True}), FakeClient({'value': 'ok'})
            config = ModelGatewayConfig.from_env()
            result = request_structured_output(primary, config, system_prompt='system', user_prompt='user', schema=Schema, client_factory=lambda c: fallback)
            self.assertEqual(result.value, 'ok')
            self.assertEqual(len(primary.calls), 2)

    def test_all_provider_failures_are_sanitized(self):
        with patch.dict(os.environ, ENV, clear=True):
            config = ModelGatewayConfig.from_env()
            with self.assertRaises(StructuredOutputError) as caught:
                request_structured_output(FakeClient(RuntimeError('gemini-test-secret')), config, system_prompt='system', user_prompt='user', schema=Schema, client_factory=lambda c: FakeClient(RuntimeError('dashscope-test-secret')))
            self.assertNotIn('test-secret', str(caught.exception))

    def test_brief_records_actual_fallback_provider_and_model(self):
        value = {'summary': 'Explore whether sales onboarding is a priority.', 'talking_points': ['Confirm current hiring.']}
        primary, fallback = FakeClient(RuntimeError('quota')), FakeClient(value)
        sections = assemble_sections({'context': context(), 'evidence': [evidence()], 'sections': None, 'error': None})['sections']
        with patch.dict(os.environ, ENV, clear=True), patch('lead_trace_worker.llm._build_client', side_effect=lambda key, base, provider: primary if provider == 'gemini' else fallback):
            result = llm.polish_brief(context(), sections, [evidence()])
        self.assertEqual(result.generation.mode, 'model_assisted')
        self.assertEqual(result.generation.provider, 'dashscope')
        self.assertEqual(result.generation.model, 'qwen3.7-plus')
        self.assertNotIn('test-secret', result.model_dump_json())

    def test_brief_schema_failure_uses_fallback_and_success_keeps_primary(self):
        for primary_value, expected in (({'invalid': True}, 'dashscope'), ({'value': 'primary'}, 'gemini')):
            with self.subTest(expected=expected), patch.dict(os.environ, ENV, clear=True):
                primary, fallback = FakeClient(primary_value), FakeClient({'value': 'fallback'})
                with patch('lead_trace_worker.llm._build_client', side_effect=lambda key, base, provider: primary if provider == 'gemini' else fallback):
                    result = llm._chat_json('system', 'user', schema=Schema)
                self.assertEqual(result.provider, expected)
                self.assertEqual(len(fallback.calls), 1 if expected == 'dashscope' else 0)
