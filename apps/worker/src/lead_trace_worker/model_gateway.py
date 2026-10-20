from __future__ import annotations

import json
import os
from typing import Optional

from pydantic import BaseModel, ValidationError

DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
DEFAULT_MODEL = 'qwen3.8-max'
MAX_STRUCTURED_OUTPUT_ATTEMPTS = 2


class ModelGatewayConfig:
    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    @classmethod
    def from_env(cls) -> ModelGatewayConfig:
        api_key = os.environ.get('DASHSCOPE_API_KEY', '').strip()
        if not api_key:
            raise ValueError('DASHSCOPE_API_KEY is required to build a model gateway config')
        base_url = os.environ.get('DASHSCOPE_BASE_URL', DEFAULT_BASE_URL)
        model = os.environ.get('DASHSCOPE_MODEL', DEFAULT_MODEL)
        return cls(api_key=api_key, base_url=base_url, model=model)


class StructuredOutputError(Exception):
    pass


def request_structured_output(
    client,
    config: ModelGatewayConfig,
    *,
    system_prompt: str,
    user_prompt: str,
    schema: type[BaseModel],
) -> BaseModel:
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]
    last_error: Optional[Exception] = None
    for _attempt in range(MAX_STRUCTURED_OUTPUT_ATTEMPTS):
        response = client.chat.completions.create(
            model=config.model,
            messages=messages,
            response_format={'type': 'json_object'},
            extra_body={'enable_thinking': False},
        )
        try:
            payload = json.loads(response.choices[0].message.content)
            return schema.model_validate(payload)
        except (json.JSONDecodeError, ValidationError, TypeError, IndexError) as error:
            # IndexError: response.choices is empty. TypeError: message.content is
            # None (e.g. a filtered or tool-call-only completion) and json.loads(None)
            # raises. Both are malformed-response shapes, not just bad JSON/schema —
            # they must stay inside the retry-then-raise contract so callers only ever
            # see StructuredOutputError, never a raw TypeError/IndexError.
            last_error = error
    raise StructuredOutputError(
        f'model response failed schema validation after {MAX_STRUCTURED_OUTPUT_ATTEMPTS} attempts: {last_error}'
    )


def build_client(config: ModelGatewayConfig):
    from openai import OpenAI

    return OpenAI(api_key=config.api_key, base_url=config.base_url)
