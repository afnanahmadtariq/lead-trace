from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from lead_trace_worker.fetch import company_news_urls, fetch_page_text, wikipedia_resolve
from lead_trace_worker.graph_brief import build_brief_graph, new_id
from lead_trace_worker.graph_evidence import build_evidence_graph
from lead_trace_worker.llm import llm_enabled
from lead_trace_worker.models import RunContext, SourceBundle
from lead_trace_worker.stages import _assemble_langgraph_evidence
from lead_trace_worker.tavily import discover_sources, tavily_configured


def _wiki_sources(prospect_name: str, company_name: Optional[str], *, use_crawl4ai: bool) -> list[SourceBundle]:
    bundles: list[SourceBundle] = []
    hints = tuple(token for token in (prospect_name.split()[-1], 'technology', 'company') if token)

    if company_name:
        company_query = company_name if ' ' in company_name.strip() else f'{company_name} Inc.'
        company_text, company_url, company_title = wikipedia_resolve(company_query, hints=hints)
        if company_text:
            bundles.append(
                SourceBundle(
                    source_id='wiki-company',
                    url=company_url or '',
                    title=f'Wikipedia · {company_title}',
                    text=company_text,
                    score=0.82,
                )
            )
        for url in company_news_urls(company_name):
            fetched = fetch_page_text(url, prefer_crawl4ai=use_crawl4ai)
            if len(fetched) > 180:
                bundles.append(
                    SourceBundle(
                        source_id='web-news',
                        url=url,
                        title=f'{company_name} newsroom',
                        text=fetched,
                        score=0.68,
                    )
                )
                break

    person_text, person_url, person_title = wikipedia_resolve(prospect_name, hints=hints)
    if person_text and person_url not in {item.url for item in bundles}:
        bundles.append(
            SourceBundle(
                source_id='wiki-person',
                url=person_url or '',
                title=f'Wikipedia · {person_title}',
                text=person_text,
                score=0.88,
            )
        )
    return bundles


def collect_public_profile(prospect_name: str, company_name: Optional[str], *, use_crawl4ai: bool) -> dict:
    bundles = discover_sources(prospect_name, company_name) if tavily_configured() else []
    source_mode = 'tavily' if bundles else 'wikipedia'
    if not bundles:
        bundles = _wiki_sources(prospect_name, company_name, use_crawl4ai=use_crawl4ai)

    context = RunContext(
        run_id='demo',
        organization_id='demo',
        goal='meeting',
        created_by_id=None,
        prospect_name=prospect_name,
        company_name=company_name,
        offer_name='Lead Trace platform',
        value_proposition='Evidence-first sales intelligence for better conversations.',
    )
    evidence_result = build_evidence_graph().invoke(
        {'context': context, 'sources': bundles, 'drafts': [], 'prefer_crawl4ai': use_crawl4ai}
    )
    sources = [{'id': bundle.source_id, 'publishedAt': None} for bundle in bundles]
    bundle_by_id = {bundle.source_id: bundle for bundle in bundles}
    reconciled = _assemble_langgraph_evidence(evidence_result['drafts'], sources)
    stored = [
        {
            'id': new_id(),
            'claim': row.claim,
            'signal_type': row.signal_type,
            'confidence': row.confidence,
            'source_url': bundle_by_id[row.source_id].url,
            'source_title': bundle_by_id[row.source_id].title,
        }
        for row in reconciled
    ]
    brief_result = build_brief_graph().invoke(
        {'context': context, 'evidence': stored, 'sections': None, 'error': None}
    )
    if brief_result.get('error'):
        raise RuntimeError(str(brief_result['error']))
    return {
        'prospect': prospect_name,
        'company': company_name,
        'source_mode': source_mode,
        'llm_enabled': llm_enabled(),
        'sources_collected': len(bundles),
        'claims_extracted': len(stored),
        'claims': stored,
        'brief': brief_result['sections'].model_dump() if brief_result['sections'] else None,
    }


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description='Collect public prospect signals without the database.')
    parser.add_argument('--prospect', required=True, help='Prospect full name')
    parser.add_argument('--company', help='Company name')
    parser.add_argument('--crawl4ai', action='store_true', help='Prefer Crawl4AI for page extraction')
    args = parser.parse_args(argv)

    payload = collect_public_profile(args.prospect, args.company, use_crawl4ai=args.crawl4ai)
    print(json.dumps(payload, indent=2))
    print(
        f"\nCollected {payload['sources_collected']} source(s) via {payload['source_mode']}"
        f" and {payload['claims_extracted']} claim(s) for {payload['prospect']}"
        f" (llm={'on' if payload['llm_enabled'] else 'off'}).",
        file=sys.stderr,
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
