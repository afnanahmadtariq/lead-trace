from __future__ import annotations

from typing import Optional

CLAIM_SQL = """
WITH candidate AS (
  SELECT r.id, r."organizationId"
  FROM research_run r
  WHERE r.status = 'running'
    AND (r."lockExpiresAt" IS NULL OR r."lockExpiresAt" < NOW())
    AND EXISTS (
      SELECT 1 FROM evidence_source s
      WHERE s."researchRunId" = r.id
        AND s."organizationId" = r."organizationId"
    )
  ORDER BY r."requestedAt" ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE research_run AS r
SET
  "lockedAt" = NOW(),
  "lockExpiresAt" = NOW() + (%s::interval),
  "workerId" = %s
FROM candidate
WHERE r.id = candidate.id
  AND r."organizationId" = candidate."organizationId"
RETURNING r.id, r."organizationId", r.status, r."attemptCount"
"""

COUNTS_SQL = """
SELECT
  (SELECT COUNT(*)::int FROM evidence_source WHERE "researchRunId" = %s AND "organizationId" = %s) AS sources,
  (SELECT COUNT(*)::int FROM evidence WHERE "researchRunId" = %s AND "organizationId" = %s) AS evidence,
  EXISTS (
    SELECT 1 FROM deal_brief
    WHERE "researchRunId" = %s AND "organizationId" = %s AND status != 'refreshing'
  ) AS has_brief
"""

BACKOFF_SQL = """
UPDATE research_run
SET "lockExpiresAt" = NOW() + (%s::interval)
WHERE id = %s AND "organizationId" = %s AND status = 'running'
"""

FAIL_SQL = """
UPDATE research_run
SET
  status = 'failed',
  "errorMessage" = %s,
  "lockedAt" = NULL,
  "lockExpiresAt" = NULL,
  "workerId" = NULL
WHERE id = %s AND "organizationId" = %s AND status = 'running'
"""

FETCH_SOURCES_SQL = """
SELECT id, url, title, publisher, excerpt, "publishedAt", metadata
FROM evidence_source
WHERE "researchRunId" = %s AND "organizationId" = %s
ORDER BY "retrievedAt" ASC
"""

INSERT_EVIDENCE_SQL = """
INSERT INTO evidence
  (id, "organizationId", "researchRunId", "sourceId", claim, "signalType", confidence, "observedAt")
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""


def next_stage(status: str, sources: int, evidence: int, has_brief: bool) -> Optional[str]:
    if status != 'running' or sources < 1:
        return None
    if evidence < 1:
        return 'evidence'
    if not has_brief:
        return 'brief'
    return None
