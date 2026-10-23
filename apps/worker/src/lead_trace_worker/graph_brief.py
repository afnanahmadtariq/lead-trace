from __future__ import annotations

import datetime
import re
from typing import Optional, TypedDict
from uuid import uuid4

from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from lead_trace_worker.extract import rank_evidence_for_brief
from lead_trace_worker.llm import personalize_outreach_draft, polish_brief
from lead_trace_worker.models import BriefCitation, BriefSections, ConversationAngle, RunContext


class StoredEvidence(TypedDict, total=False):
    id: str
    claim: str
    signal_type: str
    confidence: float
    source_url: str
    source_title: str
    observed_at: Optional[str]


class BriefState(TypedDict):
    context: RunContext
    evidence: list[StoredEvidence]
    sections: Optional[BriefSections]
    error: Optional[str]


THIN_EVIDENCE_CLAIM_LIMIT = 2
THIN_EVIDENCE_CONFIDENCE = 0.65
SELLER_INTENT = ('i want to sell', 'i need to get', 'buy my', 'sell my', 'get him to', 'get her to', 'get them to')


def _buyer_outcome(context: RunContext) -> tuple[str, bool]:
    value = ' '.join(context.value_proposition.split()).strip().rstrip('.')
    vague = len(value) < 25 or any(phrase in value.lower() for phrase in SELLER_INTENT)
    if vague:
        return f'the workflow {context.offer_name} is designed to improve', True
    return value, False


def _parse_observed_at(value: Optional[str]) -> Optional[datetime.date]:
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _compute_urgency(evidence: list[dict]) -> tuple[float, str]:
    if not evidence:
        return 0.0, 'Low'

    today = datetime.date.today()
    recent_window = today - datetime.timedelta(days=30)
    recent_events: list[dict] = []
    event_types = {'hiring', 'funding', 'launch', 'leadership', 'partnership'}
    seen: set[str] = set()
    for row in evidence:
        observed = _parse_observed_at(row.get('observed_at'))
        if str(row.get('signal_type', 'other')) not in event_types:
            continue
        if not observed or not recent_window <= observed <= today:
            continue
        if row.get('signal_type') == 'leadership' and not re.search(
            r'\b(appointed|named|promoted|succeeded|succeeds|joins|joined|became)\b',
            str(row.get('claim', '')), re.I,
        ):
            continue
        key = ' '.join(str(row.get('claim', '')).casefold().split())
        if key and key in seen:
            continue
        seen.add(key)
        recent_events.append(row)

    if not recent_events:
        return 0.0, 'Low'
    avg_confidence = sum(float(row.get('confidence', 0.0)) for row in recent_events) / len(recent_events)
    hiring_signals = sum(row.get('signal_type') == 'hiring' for row in recent_events)
    score = min(1.0, len(recent_events) * 0.25 + hiring_signals * 0.15 + avg_confidence * 0.2)
    if score >= 0.65:
        label = 'High urgency'
    elif score >= 0.35:
        label = 'Moderate'
    else:
        label = 'Low'
    return round(score, 2), label


def _signal_questions(context: RunContext, evidence: list[dict]) -> list[str]:
    company = context.company_name or 'your company'
    first = context.prospect_name.split()[0]
    questions: list[str] = []
    types = {str(row.get('signal_type', 'other')) for row in evidence}

    if 'leadership' in types or 'role-context' in types:
        questions.append(f'{first}, which priorities in your role at {company} should guide this conversation?')
    if 'hiring' in types:
        questions.append(f'Is the hiring described in these sources still active at {company}, and what outcomes matter most?')
    if 'launch' in types or 'partnership' in types:
        questions.append(f'Are the cited launches or partnerships relevant to your team’s current priorities at {company}?')
    if 'funding' in types:
        questions.append(f'Does the funding described in these sources affect current priorities at {company}?')

    questions.append(f'Where would {context.offer_name} need to prove value fastest to be worth your time?')
    questions.append(f'What current workflow would {context.offer_name} need to improve to earn a deeper evaluation?')
    return questions[:4]


def _conversation_angles(context: RunContext, citations: list[BriefCitation]) -> list[ConversationAngle]:
    """Turn a cited signal into a conditional fit hypothesis, never a buyer fact."""
    offer = context.offer_name
    by_type = {
        'hiring': (
            f'If the cited hiring changes a workflow that {offer} supports, there may be a fit to explore.',
            f'Is this hiring changing any workflows relevant to {offer}?',
        ),
        'funding': (
            f'If the cited funding supports an initiative related to {offer}, it could be worth validating the priority.',
            f'Which priorities, if any, connect this funding to the outcome behind {offer}?',
        ),
        'launch': (
            f'If the cited launch creates work related to {offer}, there may be a useful fit; confirm the impact first.',
            f'What, if anything, does this launch change about how your team approaches the area {offer} supports?',
        ),
        'partnership': (
            f'If the cited partnership affects work related to {offer}, there could be an opportunity to help.',
            f'Does this partnership change any goals or workflows relevant to {offer}?',
        ),
        'leadership': (
            f'If this role owns the outcome behind {offer}, the prospect may help validate fit; the title alone does not establish that.',
            f'Does the outcome behind {offer} fall within your remit, or does another team own it?',
        ),
    }
    fallback = (
        f'If this public context connects to an active priority related to {offer}, there may be a fit worth exploring.',
        f'Is this context relevant to any current work that {offer} would need to support?',
    )
    return [
        ConversationAngle(evidence_id=citation.evidence_id,
                          why_it_matters=by_type.get(citation.signal_type, fallback)[0],
                          question=by_type.get(citation.signal_type, fallback)[1])
        for citation in citations[:3]
    ]


def assemble_sections(state: BriefState) -> BriefState:
    context = state['context']
    ranked = rank_evidence_for_brief(state['evidence'], context, limit=5)
    company = context.company_name or 'the prospect company'
    first = context.prospect_name.split()[0]

    if not ranked:
        total = len(state['evidence'])
        gap = (
            f'{total} stored claim(s) failed relevance or quality filtering — none are citable in this brief.'
            if total
            else 'Try richer identifiers (company domain, LinkedIn URL) or rerun discovery through Tavily.'
        )
        sections = BriefSections(
            summary=f'Public signals for {context.prospect_name} at {company} were thin after quality filtering.',
            key_signals=[],
            talking_points=[f'No high-confidence, citable signals cleared the relevance gate for {context.prospect_name}.'],
            questions_to_ask=[
                f'{first}, what changed recently at {company} that made this conversation worth scheduling?',
                f'Where would {context.offer_name} need to prove value in the first 30 days?',
            ],
            outreach_draft=None,
            gaps=[gap],
            urgency_score=0.0,
            urgency_label='Low',
        )
        return {**state, 'sections': sections, 'error': None}

    citations = [
        BriefCitation(
            evidence_id=str(item['id']),
            claim=str(item['claim']),
            source_url=str(item['source_url']),
            signal_type=item['signal_type'],  # type: ignore[arg-type]
        )
        for item in ranked
    ]
    lead = str(ranked[0]['claim'])
    _, vague_offer_context = _buyer_outcome(context)
    use_case = 'meeting' if context.goal == 'meeting' else 'outreach'
    summary = (
        f'Prepare your {use_case} with {context.prospect_name} at {company} using '
        f'{len(citations)} source-backed signal(s). '
        f'Explore whether {context.offer_name} addresses a current priority; the research does not establish a buying need.'
    )
    talking_points = [
        f"Start with the source-backed signal: {row['claim']}"
        for row in ranked[:3]
    ]
    questions = _signal_questions(context, ranked)
    outreach = None
    personalized = f'{first}, I came across this public signal: {lead} Is it relevant to your current priorities at {company}?'
    objections = [
        f'If timing is not a priority: ask what event would make the outcome behind {context.offer_name} urgent.',
        f'If an existing approach is in place: ask where the current workflow still creates friction before positioning {context.offer_name}.',
    ]
    next_steps = (
        [
            f'Confirm which cited signal maps to an active priority at {company}.',
            f'Agree on one workflow where {context.offer_name} can prove value and identify the decision owner.',
        ]
        if context.goal == 'meeting'
        else [f'Ask for a 15-minute conversation to validate whether the cited signal is creating a priority at {company}.']
    )
    if context.goal == 'outreach':
        outreach = personalize_outreach_draft(
            f'Hi {first},\n\nI came across this public signal: {lead}\n\n'
            f'I’m reaching out about {context.offer_name}. Is this area a current priority for your team at {company}? '
            f'If so, would a short conversation be useful?',
            context.sender_name,
        )

    gaps: list[str] = []
    if vague_offer_context:
        gaps.append('Offer context lacks a measurable buyer outcome — add the problem solved and expected result for sharper messaging.')
    if len(ranked) <= THIN_EVIDENCE_CLAIM_LIMIT:
        gaps.append(
            f'Only {len(ranked)} source-backed public signal(s) cleared the relevance gate — treat conclusions as preliminary.'
        )
    elif all(float(item.get('confidence', 0.0)) < THIN_EVIDENCE_CONFIDENCE for item in ranked):
        gaps.append('All cited signals are below the high-confidence threshold — verify before relying on them in outreach.')

    urgency_score, urgency_label = _compute_urgency(ranked)
    if urgency_score == 0.0:
        gaps.append('No dated public event in the last 30 days supports a timing claim; confirm current priorities directly.')
    else:
        gaps.append('Urgency reflects recent cited public events, not confirmed buying intent.')

    sections = BriefSections(
        summary=summary,
        key_signals=citations,
        conversation_angles=_conversation_angles(context, citations),
        talking_points=talking_points,
        questions_to_ask=questions if context.goal == 'meeting' else [],
        personalized_opener=personalized,
        objection_handling=objections,
        next_steps=next_steps,
        outreach_draft=outreach,
        gaps=gaps,
        urgency_score=urgency_score,
        urgency_label=urgency_label,  # type: ignore[arg-type]
    )
    return {**state, 'sections': sections, 'error': None}


def polish_sections(state: BriefState) -> BriefState:
    sections = state['sections']
    if sections is None:
        return state
    cited_ids = {citation.evidence_id for citation in sections.key_signals}
    cited_evidence = [row for row in state['evidence'] if row['id'] in cited_ids]
    polished = polish_brief(state['context'], sections, cited_evidence)
    return {**state, 'sections': polished}


def citation_gate(state: BriefState) -> BriefState:
    sections = state['sections']
    if sections is None:
        return {**state, 'error': 'brief sections missing'}
    evidence_by_id = {item['id']: item for item in state['evidence']}
    for citation in sections.key_signals:
        stored = evidence_by_id.get(citation.evidence_id)
        if stored is None:
            return {**state, 'error': f'unresolved evidence id: {citation.evidence_id}'}
        if str(stored.get('source_url', '')) != citation.source_url:
            return {**state, 'error': f'source_url mismatch for evidence id: {citation.evidence_id}'}
        if str(stored.get('claim', '')) != citation.claim:
            return {**state, 'error': f'claim mismatch for evidence id: {citation.evidence_id}'}
    cited_ids = {citation.evidence_id for citation in sections.key_signals}
    for angle in sections.conversation_angles:
        if angle.evidence_id not in cited_ids:
            return {**state, 'error': f'uncited conversation angle evidence id: {angle.evidence_id}'}
    try:
        BriefSections.model_validate(sections.model_dump())
    except ValidationError as error:
        return {**state, 'error': str(error)}
    return state


def build_brief_graph():
    graph = StateGraph(BriefState)
    graph.add_node('assemble', assemble_sections)
    graph.add_node('polish', polish_sections)
    graph.add_node('gate', citation_gate)
    graph.add_edge(START, 'assemble')
    graph.add_edge('assemble', 'polish')
    graph.add_edge('polish', 'gate')
    graph.add_edge('gate', END)
    return graph.compile()


def new_id() -> str:
    return uuid4().hex[:25]
