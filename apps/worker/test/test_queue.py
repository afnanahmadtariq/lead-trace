import unittest

from lead_trace_worker.pipeline import CLAIM_SQL, next_stage


class NextStageTest(unittest.TestCase):
    def test_only_running_runs_with_sources_are_work(self):
        self.assertIsNone(next_stage('queued', 1, 0, False))
        self.assertIsNone(next_stage('running', 0, 0, False))
        self.assertEqual(next_stage('running', 2, 0, False), 'evidence')
        self.assertEqual(next_stage('running', 2, 3, False), 'brief')
        self.assertIsNone(next_stage('running', 2, 3, True))
        self.assertIsNone(next_stage('failed', 2, 0, False))

    def test_claim_keeps_tenant_key_and_skip_locked(self):
        self.assertIn('FOR UPDATE SKIP LOCKED', CLAIM_SQL)
        self.assertIn('r."organizationId" = candidate."organizationId"', CLAIM_SQL)
        self.assertIn('s."organizationId" = r."organizationId"', CLAIM_SQL)

    def test_prisma_schema_query_is_stripped_for_psycopg(self):
        from lead_trace_worker.db import postgres_url
        self.assertEqual(
            postgres_url('postgresql://postgres:x@localhost:5432/lead-trace?schema=public'),
            'postgresql://postgres:x@localhost:5432/lead-trace',
        )


if __name__ == '__main__':
    unittest.main()
