from __future__ import annotations

import os
import re
from typing import Optional

import httpx

from lead_trace_worker.models import SourceBundle

TAVILY_URL = 'https://api.tavily.com/search'
USER_AGENT = 'LeadTrace-Research/0.1'


def _clean(value: Optional[str], maximum: int = 100) -> str:
    if not value:
        return ''
    return re.sub(r'\s+', ' ', value.replace('"', ' ').replace('\n', ' ')).strip()[:maximum]


def _quoted(value: Optional[str]) -> str:
    term = _clean(value)
    return f'"{term}"' if term else ''


def build_discovery_queries(
    prospect_name: str,
    company_name: Optional[str] = None,
    company_domain: Optional[str] = None,
) -> list[dict]:
    person = _quoted(prospect_name)
    company = _quoted(company_name)
    domain = _clean(company_domain, 253)
    queries = [
        {
            'kind': 'prospect-profile',
            'query': ' '.join(filter(None, [person, company or domain, 'professional profile role experience']))[:400],
            'topic': 'general',
        }
    ]
    if company or domain:
        queries.extend(
            [
                {
                    'kind': 'company-overview',
                    'query': ' '.join(filter(None, [company, domain, 'products customers leadership company overview']))[:400],
                    'topic': 'general',
                },
                {
                    'kind': 'recent-company-signals',
                    'query': ' '.join(filter(None, [company or domain, 'funding launch partnership hiring expansion']))[:400],
                    'topic': 'news',
                    'days': 90,
                },
            ]
        )
    return [item for item in queries if item['query'].strip()]


def tavily_configured() -> bool:
    key = os.environ.get('TAVILY_API_KEY', '').strip()
    return bool(key) and not key.startswith('replace-')


def search(query: str, *, topic: str = 'general', days: Optional[int] = None) -> list[dict]:
    api_key = os.environ.get('TAVILY_API_KEY', '').strip()
    if not api_key:
        return []
    body: dict = {
        'api_key': api_key,
        'query': query[:400],
        'search_depth': os.environ.get('TAVILY_SEARCH_DEPTH', 'advanced'),
        'max_results': int(os.environ.get('TAVILY_MAX_RESULTS', '6')),
        'topic': topic,
        'include_answer': False,
        'include_raw_content': False,
    }
    if days:
        body['days'] = days
    with httpx.Client(timeout=25.0, headers={'User-Agent': USER_AGENT}) as client:
        response = client.post(TAVILY_URL, json=body)
        response.raise_for_status()
        payload = response.json()
    return list(payload.get('results') or [])


def discover_sources(
    prospect_name: str,
    company_name: Optional[str] = None,
    company_domain: Optional[str] = None,
) -> list[SourceBundle]:
    if not tavily_configured():
        return []

    deduped: dict[str, SourceBundle] = {}
    for item in build_discovery_queries(prospect_name, company_name, company_domain):
        for result in search(item['query'], topic=item.get('topic', 'general'), days=item.get('days')):
            url = str(result.get('url') or '').strip()
            if not url.startswith(('http://', 'https://')):
                continue
            title = str(result.get('title') or url).strip()[:500]
            excerpt = str(result.get('content') or '').strip()[:2000]
            score = float(result.get('score') or 0.0)
            existing = deduped.get(url)
            if existing is not None and score <= existing.score:
                continue
            deduped[url] = SourceBundle(
                source_id='pending',
                url=url,
                title=title,
                text=excerpt,
                score=score,
            )
    ranked = sorted(deduped.values(), key=lambda row: row.score, reverse=True)
    return [
        bundle.model_copy(update={'source_id': f'tavily-{index}'})
        for index, bundle in enumerate(ranked[:12])
    ]
