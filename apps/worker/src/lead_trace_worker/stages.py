from __future__ import annotations

import datetime
import json
import logging
import os
from typing import Any, Callable, Optional, Union

from lead_trace_worker import evidence
from lead_trace_worker.graph_brief import build_brief_graph, new_id
from lead_trace_worker.graph_evidence import build_evidence_graph
from lead_trace_worker.email import send_brief_ready_email
from lead_trace_worker.model_gateway import ModelGatewayConfig, build_client
from lead_trace_worker.models import EvidenceDraft, RunContext, SourceBundle
from lead_trace_worker.pipeline import FETCH_SOURCES_SQL, INSERT_EVIDENCE_SQL

log = logging.getLogger('lead-trace.worker.stages')

LOAD_RUN_SQL = """
SELECT
  r.id,
  r."organizationId",
  r.goal,
  r."createdById",
  COALESCE(NULLIF(r."inputSnapshot" #>> '{prospect,name}', ''), p.name),
  COALESCE(NULLIF(r."inputSnapshot" #>> '{prospect,companyName}', ''), p."companyName"),
  o.name,
  o."valueProposition",
  COALESCE(NULLIF(r."inputSnapshot" #>> '{sender,name}', ''), creator.name)
FROM research_run r
JOIN prospect p
  ON p.id = r."prospectId" AND p."organizationId" = r."organizationId"
JOIN offer o
  ON o.id = r."offerId" AND o."organizationId" = r."organizationId"
LEFT JOIN "user" creator
  ON creator.id = r."createdById"
WHERE r.id = %s AND r."organizationId" = %s
"""

LOAD_SOURCES_SQL = """
SELECT id, url, title, excerpt, metadata, "publishedAt"
FROM evidence_source
WHERE "researchRunId" = %s AND "organizationId" = %s
ORDER BY "retrievedAt" ASC
"""

LOAD_EVIDENCE_SQL = """
SELECT e.id, e.claim, e."signalType", e.confidence, s.url, s.title, e."observedAt"
FROM evidence e
JOIN evidence_source s
  ON s.id = e."sourceId" AND s."organizationId" = e."organizationId"
WHERE e."researchRunId" = %s AND e."organizationId" = %s
ORDER BY e.confidence DESC, e."createdAt" ASC
"""

LOAD_USER_EMAIL_SQL = """
SELECT email, name FROM "user" WHERE id = %s
"""

INSERT_BRIEF_SQL = """
INSERT INTO deal_brief (
  id, "organizationId", "researchRunId", title, status, sections, "generatedAt", "updatedAt"
) VALUES (%s, %s, %s, %s, 'ready', %s::jsonb, NOW(), NOW())
"""

UPDATE_BRIEF_SQL = """
UPDATE deal_brief
SET title = %s, status = 'ready', sections = %s::jsonb, "updatedAt" = NOW()
WHERE id = %s AND "organizationId" = %s
"""

INSERT_NOTIFICATION_SQL = """
INSERT INTO notification (
  id, "organizationId", "userId", "researchRunId", type, title, body, "createdAt"
) VALUES (%s, %s, %s, %s, 'brief-ready', %s, %s, NOW())
"""

RELEASE_LOCK_SQL = """
UPDATE research_run
SET "lockedAt" = NULL, "lockExpiresAt" = NULL, "workerId" = NULL, "attemptCount" = "attemptCount" + 1
WHERE id = %s AND "organizationId" = %s AND status = 'running'
"""

COMPLETE_RUN_SQL = """
UPDATE research_run
SET
  status = 'completed',
  "completedAt" = NOW(),
  "lockedAt" = NULL,
  "lockExpiresAt" = NULL,
  "workerId" = NULL,
  "attemptCount" = "attemptCount" + 1,
  "errorMessage" = NULL
WHERE id = %s AND "organizationId" = %s AND status = 'running'
"""


def _source_score(metadata: Any) -> float:
    if not isinstance(metadata, dict):
        return 0.0
    matches = metadata.get('matches')
    if not isinstance(matches, list) or not matches:
        return 0.0
    scores = [float(item.get('score', 0)) for item in matches if isinstance(item, dict)]
    return max(scores) if scores else 0.0


def _gateway_enabled() -> bool:
    return bool(os.environ.get('DASHSCOPE_API_KEY', '').strip())


def _is_blank_excerpt(excerpt: Optional[str]) -> bool:
    return excerpt is None or not excerpt.strip()


def _format_source_published_at(value: Union[datetime.date, datetime.datetime]) -> str:
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    return value.isoformat()


def _prefer_source_published_at(
    source: dict, claims: list[evidence.ExtractedClaim]
) -> list[evidence.ExtractedClaim]:
    published_at = source.get('publishedAt')
    if published_at is None:
        return claims
    observed_at = _format_source_published_at(published_at)
    # A newly published retrospective must not turn an old event into a new one.
    return [claim if claim.observedAt else claim.model_copy(update={'observedAt': observed_at}) for claim in claims]


def run_context_from_row(row: tuple[Any, ...]) -> RunContext:
    return RunContext(
        run_id=row[0],
        organization_id=row[1],
        goal=row[2],
        created_by_id=row[3],
        prospect_name=row[4],
        company_name=row[5],
        offer_name=row[6],
        value_proposition=row[7],
        sender_name=row[8],
    )


def _process_evidence_gateway(
    connection,
    run_id: str,
    organization_id: str,
    context: RunContext,
    *,
    model_client_factory: Optional[Callable[[ModelGatewayConfig], object]] = None,
) -> int:
    source_rows = connection.execute(FETCH_SOURCES_SQL, (run_id, organization_id)).fetchall()
    sources = [
        {
            'id': source_id,
            'url': url,
            'title': title,
            'publisher': publisher,
            'excerpt': excerpt,
            'publishedAt': published_at,
            'score': _source_score(metadata),
        }
        for source_id, url, title, publisher, excerpt, published_at, metadata in source_rows
    ]
    if not sources:
        raise RuntimeError('no sources to normalize')
    # End the read transaction so none stays open across model calls; the run lease guards the work.
    connection.commit()

    config = ModelGatewayConfig.from_env()
    client = (model_client_factory or build_client)(config)
    claims_by_source: list[tuple[str, list[evidence.ExtractedClaim]]] = []
    for source in sources:
        if _is_blank_excerpt(source['excerpt']):
            log.warning(
                'evidence extraction skipped for source with no excerpt run_id=%s source_id=%s',
                run_id,
                source['id'],
            )
            claims_by_source.append((source['id'], []))
            continue
        try:
            extracted = evidence.extract_claims_for_source(client, config, source, context)
        except Exception as error:
            # One source's timeout or API error must not discard claims from the others.
            log.warning(
                'evidence extraction failed for source run_id=%s source_id=%s error=%s',
                run_id,
                source['id'],
                str(error)[:1000],
            )
            extracted = []
        filtered = evidence.filter_claims_for_source(extracted, source=source, context=context)
        claims_by_source.append((source['id'], _prefer_source_published_at(source, filtered)))

    resolvable_source_ids = {source['id'] for source in sources}
    evidence_rows = evidence.assemble_evidence_rows(claims_by_source, resolvable_source_ids)
    if not evidence_rows:
        raise RuntimeError('no evidence claims survived extraction')

    for row in evidence_rows:
        connection.execute(
            INSERT_EVIDENCE_SQL,
            (
                new_id(),
                organization_id,
                run_id,
                row.source_id,
                row.claim,
                row.signal_type,
                row.confidence,
                row.observed_at,
            ),
        )
    log.info('evidence gateway complete run_id=%s claims=%s', run_id, len(evidence_rows))
    return len(evidence_rows)


def _assemble_langgraph_evidence(
    drafts: list[EvidenceDraft], sources: list[dict[str, Any]]
) -> list[evidence.EvidenceRow]:
    published_by_source = {source['id']: source.get('publishedAt') for source in sources}
    grouped: dict[str, list[EvidenceDraft]] = {}
    for draft in drafts:
        grouped.setdefault(draft.source_id, []).append(draft)

    claims_by_source: list[tuple[str, list[evidence.ExtractedClaim]]] = []
    for source_id, source_drafts in grouped.items():
        claims = [
            evidence.ExtractedClaim(
                claim=draft.claim,
                signalType=draft.signal_type,
                confidence=draft.confidence,
            )
            for draft in source_drafts
        ]
        published_at = published_by_source.get(source_id)
        if published_at is not None:
            claims = _prefer_source_published_at({'publishedAt': published_at}, claims)
        claims_by_source.append((source_id, claims))

    resolvable_source_ids = {source['id'] for source in sources}
    return evidence.assemble_evidence_rows(claims_by_source, resolvable_source_ids)


def _process_evidence_langgraph(connection, run_id: str, organization_id: str, context: RunContext) -> int:
    source_rows = connection.execute(LOAD_SOURCES_SQL, (run_id, organization_id)).fetchall()
    if not source_rows:
        raise RuntimeError('no sources to normalize')
    # End the read transaction so none stays open across page fetches and model calls.
    connection.commit()

    sources = [
        {
            'id': source_id,
            'url': url,
            'title': title,
            'excerpt': excerpt,
            'publishedAt': published_at,
        }
        for source_id, url, title, excerpt, metadata, published_at in source_rows
    ]
    bundles = [
        SourceBundle(
            source_id=source_id,
            url=url,
            title=title,
            text=(excerpt or '').strip(),
            score=_source_score(metadata),
        )
        for source_id, url, title, excerpt, metadata, published_at in source_rows
    ]
    result = build_evidence_graph().invoke({'context': context, 'sources': bundles, 'drafts': []})
    drafts = result['drafts']
    evidence_rows = _assemble_langgraph_evidence(drafts, sources)
    if not evidence_rows:
        raise RuntimeError('evidence normalization produced zero claims')

    for row in evidence_rows:
        connection.execute(
            INSERT_EVIDENCE_SQL,
            (
                new_id(),
                organization_id,
                run_id,
                row.source_id,
                row.claim,
                row.signal_type,
                row.confidence,
                row.observed_at,
            ),
        )
    log.info('evidence langgraph complete run_id=%s claims=%s', run_id, len(evidence_rows))
    return len(evidence_rows)


def process_evidence_stage(
    connection,
    run_id: str,
    organization_id: str,
    *,
    model_client_factory: Optional[Callable[[ModelGatewayConfig], object]] = None,
) -> int:
    row = connection.execute(LOAD_RUN_SQL, (run_id, organization_id)).fetchone()
    if not row:
        raise RuntimeError('research run not found')
    existing = connection.execute(
        'SELECT COUNT(*)::int FROM evidence WHERE "researchRunId" = %s AND "organizationId" = %s',
        (run_id, organization_id),
    ).fetchone()[0]
    if existing > 0:
        log.info('evidence stage skipped run_id=%s existing_claims=%s', run_id, existing)
        return existing

    context = run_context_from_row(row)
    if _gateway_enabled():
        return _process_evidence_gateway(
            connection,
            run_id,
            organization_id,
            context,
            model_client_factory=model_client_factory,
        )

    return _process_evidence_langgraph(connection, run_id, organization_id, context)


def _format_observed_at(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return str(value)[:10]


def process_brief_stage(
    connection, run_id: str, organization_id: str
) -> tuple[str, Optional[Callable[[], None]]]:
    """Returns the brief id and an email sender the caller must invoke only after committing."""
    row = connection.execute(LOAD_RUN_SQL, (run_id, organization_id)).fetchone()
    if not row:
        raise RuntimeError('research run not found')
    existing = connection.execute(
        'SELECT id, status FROM deal_brief WHERE "researchRunId" = %s AND "organizationId" = %s',
        (run_id, organization_id),
    ).fetchone()
    if existing and existing[1] != 'refreshing':
        connection.execute(COMPLETE_RUN_SQL, (run_id, organization_id))
        log.info('brief stage skipped run_id=%s existing_brief_id=%s', run_id, existing[0])
        return str(existing[0]), None
    context = run_context_from_row(row)
    evidence_rows = connection.execute(LOAD_EVIDENCE_SQL, (run_id, organization_id)).fetchall()
    if not evidence_rows:
        raise RuntimeError('no evidence to synthesize')
    # End the read transaction so none stays open across brief synthesis model calls.
    connection.commit()

    stored = [
        {
            'id': evidence_id,
            'claim': claim,
            'signal_type': signal_type,
            'confidence': confidence,
            'source_url': source_url,
            'source_title': source_title,
            'observed_at': _format_observed_at(observed_at),
        }
        for evidence_id, claim, signal_type, confidence, source_url, source_title, observed_at in evidence_rows
    ]
    result = build_brief_graph().invoke({'context': context, 'evidence': stored, 'sections': None, 'error': None})
    if result.get('error'):
        raise RuntimeError(str(result['error']))
    sections = result['sections']
    if sections is None:
        raise RuntimeError('brief synthesis returned no sections')

    title = f"Deal brief · {context.prospect_name}"
    sections_json = json.dumps(sections.model_dump())
    send_email: Optional[Callable[[], None]] = None
    if existing and existing[1] == 'refreshing':
        brief_id = str(existing[0])
        connection.execute(UPDATE_BRIEF_SQL, (title, sections_json, brief_id, organization_id))
    else:
        brief_id = new_id()
        connection.execute(
            INSERT_BRIEF_SQL,
            (brief_id, organization_id, run_id, title, sections_json),
        )
        if context.created_by_id:
            connection.execute(
                INSERT_NOTIFICATION_SQL,
                (
                    new_id(),
                    organization_id,
                    context.created_by_id,
                    run_id,
                    f'Brief ready for {context.prospect_name}',
                    f'{len(sections.key_signals)} cited signal(s) are ready to review.',
                ),
            )
            user_row = connection.execute(LOAD_USER_EMAIL_SQL, (context.created_by_id,)).fetchone()
            if user_row and user_row[0]:
                to = str(user_row[0])
                recipient_name = str(user_row[1]) if user_row[1] else None

                def send_email() -> None:
                    try:
                        send_brief_ready_email(
                            to=to,
                            prospect_name=context.prospect_name,
                            brief_id=brief_id,
                            recipient_name=recipient_name,
                        )
                    except Exception as error:
                        log.warning('brief-ready email failed run_id=%s error=%s', run_id, str(error)[:500])
    connection.execute(COMPLETE_RUN_SQL, (run_id, organization_id))
    log.info('brief stage complete run_id=%s brief_id=%s', run_id, brief_id)
    return brief_id, send_email
