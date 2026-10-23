from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import uuid4

from lead_trace_worker.model_gateway import ModelGatewayConfig, build_client
from lead_trace_worker.pipeline import BACKOFF_SQL, CLAIM_SQL, COUNTS_SQL, FAIL_SQL, next_stage

log = logging.getLogger('lead-trace.worker')


def postgres_url(url: str) -> str:
    parsed = urlparse(url)
    query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key.lower() != 'schema']
    return urlunparse(parsed._replace(query=urlencode(query)))


def load_database_url() -> str:
    if url := os.environ.get('DATABASE_URL', '').strip():
        return postgres_url(url)
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        for folder in [start, *start.parents]:
            env_file = folder / '.env'
            if not env_file.is_file():
                continue
            for raw in env_file.read_text().splitlines():
                line = raw.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                if key.strip() == 'DATABASE_URL':
                    return postgres_url(value.strip().strip('"').strip("'"))
    raise RuntimeError('DATABASE_URL is required')


class Worker:
    def __init__(
        self,
        database_url: str,
        worker_id: Optional[str] = None,
        model_client_factory: Optional[Callable[[ModelGatewayConfig], object]] = None,
    ):
        self.database_url = database_url
        self.worker_id = worker_id or uuid4().hex[:12]
        self.lock_for = os.environ.get('WORKER_LOCK_INTERVAL', '10 minutes')
        self.backoff_for = os.environ.get('WORKER_BACKOFF_INTERVAL', '30 seconds')
        self._model_client_factory = model_client_factory or build_client

    @classmethod
    def from_env(cls) -> Worker:
        return cls(load_database_url())

    def check_connection(self) -> None:
        import psycopg

        with psycopg.connect(self.database_url) as connection:
            connection.execute('SET statement_timeout = 15000')
            connection.execute('SELECT 1').fetchone()

    def poll_once(self) -> bool:
        import psycopg

        with psycopg.connect(self.database_url) as connection:
            connection.execute('SET statement_timeout = 15000')
            claimed = connection.execute(CLAIM_SQL, (self.lock_for, self.worker_id)).fetchone()
            if not claimed:
                connection.commit()
                log.debug('poll finished worker_id=%s outcome=idle', self.worker_id)
                return False
            started_at = time.monotonic()
            run_id, organization_id, status, attempt_count = claimed
            log.info(
                'job claimed worker_id=%s run_id=%s workspace_id=%s status=%s attempt=%s',
                self.worker_id,
                run_id,
                organization_id,
                status,
                attempt_count,
            )
            try:
                sources, evidence_count, has_brief = connection.execute(
                    COUNTS_SQL,
                    (run_id, organization_id, run_id, organization_id, run_id, organization_id),
                ).fetchone()
                stage = next_stage(status, sources, evidence_count, bool(has_brief))
                log.info(
                    'job inspected worker_id=%s run_id=%s workspace_id=%s sources=%s evidence=%s has_brief=%s next_stage=%s',
                    self.worker_id,
                    run_id,
                    organization_id,
                    sources,
                    evidence_count,
                    bool(has_brief),
                    stage or 'none',
                )
                if stage is None:
                    connection.execute(BACKOFF_SQL, (self.backoff_for, run_id, organization_id))
                    connection.commit()
                    elapsed_ms = round((time.monotonic() - started_at) * 1000)
                    log.info(
                        'job cycle finished worker_id=%s run_id=%s workspace_id=%s outcome=deferred reason=no_pending_stage retry_in=%s duration_ms=%s',
                        self.worker_id,
                        run_id,
                        organization_id,
                        self.backoff_for,
                        elapsed_ms,
                    )
                    return True
                if stage == 'evidence':
                    from lead_trace_worker.stages import process_evidence_stage

                    inserted = process_evidence_stage(
                        connection,
                        run_id,
                        organization_id,
                        model_client_factory=self._model_client_factory,
                    )
                    connection.execute(BACKOFF_SQL, (self.backoff_for, run_id, organization_id))
                    connection.commit()
                    elapsed_ms = round((time.monotonic() - started_at) * 1000)
                    log.info(
                        'job cycle finished worker_id=%s run_id=%s workspace_id=%s stage=evidence outcome=success claims=%s duration_ms=%s',
                        self.worker_id,
                        run_id,
                        organization_id,
                        inserted,
                        elapsed_ms,
                    )
                    return True
                if stage == 'brief':
                    from lead_trace_worker.stages import process_brief_stage

                    brief_id = process_brief_stage(connection, run_id, organization_id)
                    connection.commit()
                    elapsed_ms = round((time.monotonic() - started_at) * 1000)
                    log.info(
                        'job cycle finished worker_id=%s run_id=%s workspace_id=%s stage=brief outcome=success brief_id=%s duration_ms=%s',
                        self.worker_id,
                        run_id,
                        organization_id,
                        brief_id,
                        elapsed_ms,
                    )
                    return True
                connection.execute(BACKOFF_SQL, (self.backoff_for, run_id, organization_id))
                connection.commit()
                elapsed_ms = round((time.monotonic() - started_at) * 1000)
                log.info(
                    'job cycle finished worker_id=%s run_id=%s workspace_id=%s stage=%s outcome=deferred reason=unknown_stage retry_in=%s duration_ms=%s',
                    self.worker_id,
                    run_id,
                    organization_id,
                    stage,
                    self.backoff_for,
                    elapsed_ms,
                )
                return True
            except Exception as error:
                message = str(error)[:1000]
                log.exception(
                    'job failed worker_id=%s run_id=%s workspace_id=%s error=%s',
                    self.worker_id,
                    run_id,
                    organization_id,
                    message,
                )
                connection.rollback()
                connection.execute(FAIL_SQL, (message, run_id, organization_id))
                connection.commit()
                return True
