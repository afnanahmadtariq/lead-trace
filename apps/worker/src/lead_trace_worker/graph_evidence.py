from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from lead_trace_worker.extract import extract_claims
from lead_trace_worker.fetch import fetch_page_text
from lead_trace_worker.llm import extract_claims_with_llm, fallback_claims, llm_enabled, refine_claims
from lead_trace_worker.models import EvidenceDraft, RunContext, SourceBundle


class EvidenceState(TypedDict):
    context: RunContext
    sources: list[SourceBundle]
    drafts: list[EvidenceDraft]


def enrich_sources(state: EvidenceState) -> EvidenceState:
    enriched: list[SourceBundle] = []
    for source in state['sources']:
        text = source.text.strip()
        if len(text) < 120:
            fetched = fetch_page_text(source.url)
            if fetched:
                text = fetched
        enriched.append(source.model_copy(update={'text': text}))
    return {**state, 'sources': enriched}


def extract_from_sources(state: EvidenceState) -> EvidenceState:
    context = state['context']
    sources = state['sources']
    drafts: list[EvidenceDraft] = []
    if llm_enabled():
        drafts = extract_claims_with_llm(context, sources, limit=8)
    if not drafts:
        drafts = fallback_claims(context, sources, limit=2)
    else:
        for source in sources:
            if not source.text.strip():
                continue
            for claim in extract_claims(
                source.text,
                prospect_name=context.prospect_name,
                company_name=context.company_name,
                source_score=source.score,
                limit=1,
            ):
                if all(existing.claim != claim.claim for existing in drafts):
                    drafts.append(
                        EvidenceDraft(
                            source_id=source.source_id,
                            claim=claim.claim,
                            signal_type=claim.signal_type,
                            confidence=claim.confidence,
                        )
                    )
    return {**state, 'drafts': drafts}


def refine_with_llm(state: EvidenceState) -> EvidenceState:
    refined = refine_claims(state['context'], state['sources'], state['drafts'])
    return {**state, 'drafts': refined}


def build_evidence_graph():
    graph = StateGraph(EvidenceState)
    graph.add_node('enrich', enrich_sources)
    graph.add_node('extract', extract_from_sources)
    graph.add_node('refine', refine_with_llm)
    graph.add_edge(START, 'enrich')
    graph.add_edge('enrich', 'extract')
    graph.add_edge('extract', 'refine')
    graph.add_edge('refine', END)
    return graph.compile()
