from __future__ import annotations

import os
from dataclasses import dataclass, field

DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
DEFAULT_DASHSCOPE_MODEL = 'qwen3.7-plus'
DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'


@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    api_key: str = field(repr=False)
    base_url: str
    model: str


def provider_order() -> list[str]:
    default = 'gemini,dashscope' if os.environ.get('NODE_ENV') == 'production' else 'dashscope'
    order = [name.strip() for name in (os.environ.get('LLM_PROVIDER_ORDER', '').strip() or default).split(',')]
    if len(set(order)) != len(order) or any(name not in ('gemini', 'dashscope') for name in order):
        raise ValueError('LLM_PROVIDER_ORDER must contain gemini and/or dashscope once each, in priority order')
    return order


def configured_providers() -> list[ProviderConfig]:
    providers = []
    for name in provider_order():
        prefix = name.upper()
        key = os.environ.get(f'{prefix}_API_KEY', '').strip()
        if not key:
            continue
        base = DEFAULT_GEMINI_BASE_URL if name == 'gemini' else DEFAULT_DASHSCOPE_BASE_URL
        model = DEFAULT_GEMINI_MODEL if name == 'gemini' else DEFAULT_DASHSCOPE_MODEL
        providers.append(ProviderConfig(
            provider=name, api_key=key,
            base_url=(os.environ.get(f'{prefix}_BASE_URL', '').strip() or base).rstrip('/'),
            model=os.environ.get(f'{prefix}_MODEL', '').strip() or os.environ.get('WORKER_LLM_MODEL', '').strip() or model,
        ))
    return providers


def request_options(provider: str) -> dict:
    if provider == 'gemini':
        return {'reasoning_effort': 'low'}
    if provider == 'dashscope':
        return {'extra_body': {'enable_thinking': False}}
    return {}
