from __future__ import annotations

import argparse
import logging
import sys
from typing import Optional

from lead_trace_worker.db import Worker
from lead_trace_worker.pipeline import next_stage
from lead_trace_worker.stages import process_brief_stage, process_evidence_stage

log = logging.getLogger('lead-trace.worker.process_run')

RUN_STATE_SQL = """
SELECT
  r."organizationId",
  r.status,
  (SELECT COUNT(*)::int FROM evidence_source s WHERE s."researchRunId" = r.id AND s."organizationId" = r."organizationId") AS sources,
  (SELECT COUNT(*)::int FROM evidence e WHERE e."researchRunId" = r.id AND e."organizationId" = r."organizationId") AS evidence,
  EXISTS (
    SELECT 1 FROM deal_brief b
    WHERE b."researchRunId" = r.id AND b."organizationId" = r."organizationId" AND b.status != 'refreshing'
  ) AS has_brief
FROM research_run r
WHERE r.id = %s
"""


def process_run(connection, run_id: str, organization_id: str) -> dict:
    row = connection.execute(RUN_STATE_SQL, (run_id,)).fetchone()
    if not row:
        raise RuntimeError(f'research run not found: {run_id}')
    org_id, status, sources, evidence, has_brief = row
    if org_id != organization_id:
        raise RuntimeError('organization mismatch for research run')
    if status != 'running':
        raise RuntimeError(f'run must be running to process (current: {status})')
    if sources < 1:
        raise RuntimeError('run has no collected sources')

    stage = next_stage(status, sources, evidence, bool(has_brief))
    if stage is None:
        return {'run_id': run_id, 'stage': 'none', 'completed': bool(has_brief)}

    if stage == 'evidence':
        inserted = process_evidence_stage(connection, run_id, organization_id)
        connection.commit()
        row = connection.execute(RUN_STATE_SQL, (run_id,)).fetchone()
        _, _, sources, evidence, has_brief = row
        stage = next_stage('running', sources, evidence, bool(has_brief))
        if stage == 'brief':
            brief_id, send_email = process_brief_stage(connection, run_id, organization_id)
            connection.commit()
            if send_email:
                send_email()
            return {'run_id': run_id, 'stage': 'brief', 'brief_id': brief_id, 'claims': inserted, 'completed': True}
        return {'run_id': run_id, 'stage': 'evidence', 'claims': inserted, 'completed': False}

    if stage == 'brief':
        brief_id, send_email = process_brief_stage(connection, run_id, organization_id)
        connection.commit()
        if send_email:
            send_email()
        return {'run_id': run_id, 'stage': 'brief', 'brief_id': brief_id, 'completed': True}

    return {'run_id': run_id, 'stage': stage or 'none', 'completed': False}


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description='Process one research run through evidence and brief stages.')
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--organization-id', help='Workspace id (optional if run id is unique)')
    args = parser.parse_args(argv)

    import psycopg

    worker = Worker.from_env()
    with psycopg.connect(worker.database_url) as connection:
        connection.execute('SET statement_timeout = 120000')
        org_id = args.organization_id
        if not org_id:
            row = connection.execute(
                'SELECT "organizationId" FROM research_run WHERE id = %s',
                (args.run_id,),
            ).fetchone()
            if not row:
                raise SystemExit(f'run not found: {args.run_id}')
            org_id = row[0]
        result = process_run(connection, args.run_id, org_id)
    print(result)
    return 0 if result.get('completed') else 0


if __name__ == '__main__':
    raise SystemExit(main())
