from __future__ import annotations

import json
import logging
from typing import Optional

from pydantic import BaseModel, ValidationError
from lead_trace_worker.providers import configured_providers, request_options, DEFAULT_DASHSCOPE_BASE_URL, DEFAULT_DASHSCOPE_MODEL

log = logging.getLogger('lead-trace.worker.model_gateway')
DEFAULT_BASE_URL = DEFAULT_DASHSCOPE_BASE_URL
DEFAULT_MODEL = DEFAULT_DASHSCOPE_MODEL
MAX_STRUCTURED_OUTPUT_ATTEMPTS = 2
# The SDK defaults (~600s, 2 retries) can stall a worker for many minutes on one call.
# Brief synthesis has no max_tokens cap, so allow long generations; still far below the SDK default of 600s.
CLIENT_TIMEOUT_SECONDS = 120
CLIENT_MAX_RETRIES = 1


class ModelGatewayConfig:
    def __init__(self, api_key: str, base_url: str, model: str, provider: str = 'dashscope', fallbacks: tuple = ()):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.provider = provider
        self.fallbacks = fallbacks

    @classmethod
    def from_env(cls) -> ModelGatewayConfig:
        providers = configured_providers()
        if not providers:
            raise ValueError('Configure an enabled GEMINI_API_KEY or DASHSCOPE_API_KEY to build a model gateway config')
        configs = [cls(p.api_key, p.base_url, p.model, provider=p.provider) for p in providers]
        configs[0].fallbacks = tuple(configs[1:])
        return configs[0]


class StructuredOutputError(Exception):
    pass


def request_structured_output(
    client,
    config: ModelGatewayConfig,
    *,
    system_prompt: str,
    user_prompt: str,
    schema: type[BaseModel],
    client_factory=None,
) -> BaseModel:
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]
    last_error: Optional[Exception] = None
    for index, provider in enumerate((config, *config.fallbacks)):
        try:
            active_client = client if index == 0 else (client_factory or build_client)(provider)
            for _attempt in range(MAX_STRUCTURED_OUTPUT_ATTEMPTS):
                response = active_client.chat.completions.create(
                    model=provider.model, messages=messages,
                    response_format={'type': 'json_object'}, **request_options(provider.provider),
                )
                try:
                    payload = json.loads(response.choices[0].message.content)
                    return schema.model_validate(payload)
                except (json.JSONDecodeError, ValidationError, TypeError, IndexError) as error:
                    last_error = error
        except Exception as error:
            last_error = error
        log.warning('model request failed provider=%s model=%s; trying next configured provider', provider.provider, provider.model)
    raise StructuredOutputError(
        f'model providers failed to return valid structured output ({type(last_error).__name__})'
    ) from None


def build_client(config: ModelGatewayConfig):
    from openai import OpenAI

    return OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        timeout=45 if config.provider == 'gemini' else CLIENT_TIMEOUT_SECONDS,
        max_retries=0 if config.provider == 'gemini' else CLIENT_MAX_RETRIES,
    )
