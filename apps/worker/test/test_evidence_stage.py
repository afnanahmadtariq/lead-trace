import json
import os
import unittest
from unittest.mock import patch
import datetime

from lead_trace_worker.db import Worker
from lead_trace_worker.models import EvidenceDraft
from lead_trace_worker.pipeline import (
    BACKOFF_SQL,
    CLAIM_SQL,
    COUNTS_SQL,
    FAIL_SQL,
    FETCH_SOURCES_SQL,
    INSERT_EVIDENCE_SQL,
)
from lead_trace_worker.stages import LOAD_RUN_SQL, _assemble_langgraph_evidence, process_brief_stage, run_context_from_row


class _FakeMessage:
    def __init__(self, content: str):
        self.content = content


class _FakeChoice:
    def __init__(self, content: str):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content: str):
        self.choices = [_FakeChoice(content)]


class _FakeCompletions:
    def __init__(self, contents: list[str]):
        self._contents = list(contents)
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        content = self._contents.pop(0)
        return _FakeResponse(content)


class _FakeChat:
    def __init__(self, contents: list[str]):
        self.completions = _FakeCompletions(contents)


class FakeModelClient:
    def __init__(self, contents: list[str]):
        self.chat = _FakeChat(contents)


class FakeCursor:
    def __init__(self, fetchone_result=None, fetchall_result=None):
        self._fetchone_result = fetchone_result
        self._fetchall_result = fetchall_result if fetchall_result is not None else []

    def fetchone(self):
        return self._fetchone_result

    def fetchall(self):
        return self._fetchall_result


RUN_ID = 'run-1'
ORGANIZATION_ID = 'org-1'
CLAIMED_ROW = (RUN_ID, ORGANIZATION_ID, 'running', 0)
SOURCE_ROW = (
    'source-1',
    'https://example.test/a',
    'Acme funding announcement',
    'A Publisher',
    'Acme announced it raised $5 million in a new funding round.',
    None,
    {'matches': [{'score': 0.9}]},
)
RUN_CONTEXT_ROW = (
    RUN_ID,
    ORGANIZATION_ID,
    'meeting',
    'user-1',
    'Jane Doe',
    'Acme',
    'Platform',
    'Better conversations.',
    'Alex Morgan',
)
EVIDENCE_ROW = (
    'evidence-1',
    'Acme announced it raised $5 million in a new funding round.',
    'funding',
    0.9,
    'https://example.test/a',
    'Acme funding announcement',
    datetime.date(2024, 1, 10),
)


class FakeConnection:
    def __init__(
        self,
        *,
        claimed_row,
        counts_row,
        sources_rows=None,
        existing_evidence_count=0,
        evidence_rows=None,
        existing_brief_id=None,
        raise_on_sql=None,
        raise_error=None,
    ):
        self.claimed_row = claimed_row
        self.counts_row = counts_row
        self.sources_rows = sources_rows if sources_rows is not None else []
        self.existing_evidence_count = existing_evidence_count
        self.evidence_rows = evidence_rows if evidence_rows is not None else []
        self.existing_brief_id = existing_brief_id
        self.raise_on_sql = raise_on_sql
        self.raise_error = raise_error
        self.actions: list[tuple] = []
        self.commit_count = 0
        self.rollback_count = 0

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql, params=None):
        self.actions.append(('execute', sql, params))
        if self.raise_on_sql is not None and sql == self.raise_on_sql:
            raise self.raise_error
        if sql == 'SET statement_timeout = 15000':
            return FakeCursor()
        if sql == CLAIM_SQL:
            return FakeCursor(fetchone_result=self.claimed_row)
        if sql == COUNTS_SQL:
            return FakeCursor(fetchone_result=self.counts_row)
        if sql == FETCH_SOURCES_SQL:
            return FakeCursor(fetchall_result=self.sources_rows)
        if 'FROM evidence_source' in sql and 'metadata' in sql:
            return FakeCursor(fetchall_result=self.sources_rows)
        if 'FROM research_run r' in sql and 'JOIN prospect p' in sql:
            return FakeCursor(fetchone_result=RUN_CONTEXT_ROW)
        if 'SELECT COUNT(*)::int FROM evidence WHERE' in sql:
            return FakeCursor(fetchone_result=(self.existing_evidence_count,))
        if 'SELECT id, status FROM deal_brief WHERE' in sql:
            if self.existing_brief_id:
                status = 'refreshing' if isinstance(self.existing_brief_id, tuple) else 'ready'
                brief_id = self.existing_brief_id[0] if isinstance(self.existing_brief_id, tuple) else self.existing_brief_id
                return FakeCursor(fetchone_result=(brief_id, status))
            return FakeCursor(fetchone_result=None)
        if 'SELECT id FROM deal_brief WHERE' in sql:
            return FakeCursor(fetchone_result=(self.existing_brief_id,) if self.existing_brief_id else None)
        if 'FROM evidence e' in sql and 'JOIN evidence_source s' in sql:
            return FakeCursor(fetchall_result=self.evidence_rows)
        if 'SELECT email, name FROM "user"' in sql:
            return FakeCursor(fetchone_result=('user@example.test', 'Alex'))
        if sql in (BACKOFF_SQL, FAIL_SQL, INSERT_EVIDENCE_SQL):
            return FakeCursor()
        if 'INSERT INTO deal_brief' in sql or 'INSERT INTO notification' in sql or 'UPDATE deal_brief' in sql:
            return FakeCursor()
        if '"completedAt" = NOW()' in sql:
            return FakeCursor()
        raise AssertionError(f'unexpected SQL executed: {sql}')

    def commit(self):
        self.actions.append(('commit', None, None))
        self.commit_count += 1

    def rollback(self):
        self.actions.append(('rollback', None, None))
        self.rollback_count += 1

    def executed_sql(self) -> list[str]:
        return [sql for kind, sql, _params in self.actions if kind == 'execute']


class _RaisingCompletions:
    def __init__(self, error: Exception):
        self._error = error
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        raise self._error


class _RaisingChat:
    def __init__(self, error: Exception):
        self.completions = _RaisingCompletions(error)


class RaisingModelClient:
    def __init__(self, error: Exception):
        self.chat = _RaisingChat(error)


class EvidenceSqlInvariantsTest(unittest.TestCase):
    def test_fetch_sources_sql_scoped_by_organization_id(self):
        self.assertIn('"organizationId"', FETCH_SOURCES_SQL)

    def test_insert_evidence_sql_scoped_by_organization_id(self):
        self.assertIn('"organizationId"', INSERT_EVIDENCE_SQL)

    def test_run_context_loads_sender_name_from_snapshot_or_profile(self):
        self.assertIn('inputSnapshot', LOAD_RUN_SQL)
        self.assertIn('creator.name', LOAD_RUN_SQL)
        self.assertEqual(run_context_from_row(RUN_CONTEXT_ROW).sender_name, 'Alex Morgan')


class EvidenceStageIdempotencyTest(unittest.TestCase):
    def test_evidence_already_present_never_builds_a_model_client(self):
        def factory(_config):
            raise AssertionError('should not be called')

        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(2, 1, False),
            existing_evidence_count=1,
            evidence_rows=[EVIDENCE_ROW],
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=factory)
        with patch.dict(os.environ, {}, clear=True):
            with patch('psycopg.connect', return_value=connection):
                result = worker.poll_once()

        self.assertTrue(result)
        self.assertNotIn(FETCH_SOURCES_SQL, connection.executed_sql())
        self.assertNotIn(INSERT_EVIDENCE_SQL, connection.executed_sql())
        # Claim commit, brief read commit before synthesis, then the brief + completion commit.
        self.assertEqual(connection.commit_count, 3)


class EvidenceStageHappyPathTest(unittest.TestCase):
    def test_extracted_claim_is_inserted_and_committed_after_insert(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[SOURCE_ROW],
        )
        fake_client = FakeModelClient(
            [json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]})]
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                result = worker.poll_once()

        self.assertTrue(result)
        insert_calls = [
            (sql, params) for kind, sql, params in connection.actions if kind == 'execute' and sql == INSERT_EVIDENCE_SQL
        ]
        self.assertEqual(len(insert_calls), 1)
        _sql, params = insert_calls[0]
        self.assertEqual(params[1], ORGANIZATION_ID)
        self.assertEqual(params[2], RUN_ID)
        self.assertEqual(params[3], 'source-1')

        insert_index = connection.actions.index(('execute', INSERT_EVIDENCE_SQL, params))
        commit_indices = [index for index, action in enumerate(connection.actions) if action[0] == 'commit']
        self.assertTrue(commit_indices)
        self.assertGreater(commit_indices[-1], insert_index)


class EvidenceStageAllClaimsDroppedTest(unittest.TestCase):
    def test_zero_surviving_claims_fails_the_run_instead_of_backing_off(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[SOURCE_ROW],
        )
        fake_client = FakeModelClient([json.dumps({'claims': []})])
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                with self.assertLogs('lead-trace.worker', level='ERROR') as logs:
                    result = worker.poll_once()

        self.assertTrue(result)
        self.assertIn('no evidence claims survived extraction', '\n'.join(logs.output))
        self.assertIn(FAIL_SQL, connection.executed_sql())
        self.assertNotIn(BACKOFF_SQL, connection.executed_sql())
        self.assertNotIn(INSERT_EVIDENCE_SQL, connection.executed_sql())


class EvidenceStageSuccessBackoffTest(unittest.TestCase):
    def test_backoff_sql_executed_after_evidence_stage_succeeds_so_run_becomes_pollable_soon(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[SOURCE_ROW],
        )
        fake_client = FakeModelClient(
            [json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]})]
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                result = worker.poll_once()

        self.assertTrue(result)
        executed_sql = connection.executed_sql()
        self.assertIn(BACKOFF_SQL, executed_sql)
        self.assertGreater(executed_sql.index(BACKOFF_SQL), executed_sql.index(INSERT_EVIDENCE_SQL))
        # Claim commit, read commit before model calls, then one commit for inserts + backoff.
        self.assertEqual(connection.commit_count, 3)


class EvidenceStageInsertFailureRollsBackTest(unittest.TestCase):
    def test_rollback_called_before_fail_sql_when_insert_raises(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[SOURCE_ROW],
            raise_on_sql=INSERT_EVIDENCE_SQL,
            raise_error=RuntimeError('constraint violation'),
        )
        fake_client = FakeModelClient(
            [json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]})]
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                with self.assertLogs('lead-trace.worker', level='ERROR') as logs:
                    result = worker.poll_once()

        self.assertTrue(result)
        self.assertIn('constraint violation', '\n'.join(logs.output))
        rollback_indices = [index for index, action in enumerate(connection.actions) if action[0] == 'rollback']
        fail_indices = [
            index
            for index, (kind, sql, _params) in enumerate(connection.actions)
            if kind == 'execute' and sql == FAIL_SQL
        ]
        self.assertTrue(rollback_indices, 'rollback() was never called')
        self.assertTrue(fail_indices, 'FAIL_SQL was never executed')
        self.assertLess(rollback_indices[0], fail_indices[0])
        self.assertEqual(connection.rollback_count, 1)


class EvidenceStageBlankExcerptTest(unittest.TestCase):
    def test_source_with_blank_excerpt_is_skipped_and_run_fails_with_no_surviving_claims(self):
        blank_source = (
            'source-blank', 'https://example.test/b', 'B Title', 'B Publisher', '   ', None,
            {'matches': [{'score': 0.8}]},
        )
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[blank_source],
        )
        fake_client = FakeModelClient([])
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                with self.assertLogs('lead-trace.worker', level='ERROR') as logs:
                    result = worker.poll_once()

        self.assertTrue(result)
        self.assertIn('no evidence claims survived extraction', '\n'.join(logs.output))
        self.assertEqual(len(fake_client.chat.completions.calls), 0)
        self.assertIn(FAIL_SQL, connection.executed_sql())
        self.assertNotIn(INSERT_EVIDENCE_SQL, connection.executed_sql())

    def test_source_with_null_excerpt_is_skipped_while_other_sources_still_process_normally(self):
        null_excerpt_source = (
            'source-null', 'https://example.test/n', 'N Title', 'N Publisher', None, None,
            {'matches': [{'score': 0.8}]},
        )
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(2, 0, False),
            sources_rows=[null_excerpt_source, SOURCE_ROW],
        )
        fake_client = FakeModelClient(
            [json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]})]
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                result = worker.poll_once()

        self.assertTrue(result)
        self.assertEqual(len(fake_client.chat.completions.calls), 1)
        insert_calls = [
            (sql, params) for kind, sql, params in connection.actions if kind == 'execute' and sql == INSERT_EVIDENCE_SQL
        ]
        self.assertEqual(len(insert_calls), 1)
        self.assertEqual(insert_calls[0][1][3], 'source-1')
        self.assertNotIn(FAIL_SQL, connection.executed_sql())


class EvidenceStageDegradeOneSourceTest(unittest.TestCase):
    def test_structured_output_error_on_one_source_degrades_it_but_run_still_succeeds(self):
        failing_source = (
            'source-fail', 'https://example.test/f', 'Fail Title', 'Fail Publisher', 'Fail excerpt', None,
            {'matches': [{'score': 0.8}]},
        )
        ok_source = (
            'source-ok', 'https://example.test/ok', 'Acme funding', 'OK Publisher',
            'Acme announced it raised $5 million in a new funding round.', None, {'matches': [{'score': 0.9}]},
        )
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(2, 0, False),
            sources_rows=[failing_source, ok_source],
        )
        fake_client = FakeModelClient(
            [
                'not json',
                'not json',
                json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]}),
            ]
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                result = worker.poll_once()

        self.assertTrue(result)
        insert_calls = [
            (sql, params) for kind, sql, params in connection.actions if kind == 'execute' and sql == INSERT_EVIDENCE_SQL
        ]
        self.assertEqual(len(insert_calls), 1)
        self.assertEqual(insert_calls[0][1][3], 'source-ok')
        self.assertNotIn(FAIL_SQL, connection.executed_sql())
        self.assertEqual(connection.commit_count, 3)

    def test_api_error_on_one_source_degrades_it_but_run_still_succeeds(self):
        failing_source = (
            'source-fail', 'https://example.test/f', 'Fail Title', 'Fail Publisher', 'Fail excerpt', None,
            {'matches': [{'score': 0.8}]},
        )
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(2, 0, False),
            sources_rows=[failing_source, SOURCE_ROW],
        )
        ok_response = json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]})
        fake_client = FakeModelClient([])

        def create(**kwargs):
            if 'Fail excerpt' in json.dumps(kwargs.get('messages')):
                raise ConnectionError('network down')
            return _FakeResponse(ok_response)

        fake_client.chat.completions.create = create
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                with self.assertLogs('lead-trace.worker', level='WARNING') as logs:
                    result = worker.poll_once()

        self.assertTrue(result)
        self.assertIn('network down', '\n'.join(logs.output))
        insert_calls = [
            (sql, params) for kind, sql, params in connection.actions if kind == 'execute' and sql == INSERT_EVIDENCE_SQL
        ]
        self.assertEqual([params[3] for _sql, params in insert_calls], ['source-1'])
        self.assertNotIn(FAIL_SQL, connection.executed_sql())

    def test_api_error_on_every_source_fails_the_run(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[SOURCE_ROW],
        )
        fake_client = RaisingModelClient(ConnectionError('network down'))
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                with self.assertLogs('lead-trace.worker', level='ERROR') as logs:
                    result = worker.poll_once()

        self.assertTrue(result)
        self.assertIn('no evidence claims survived extraction', '\n'.join(logs.output))
        self.assertIn(FAIL_SQL, connection.executed_sql())
        self.assertNotIn(INSERT_EVIDENCE_SQL, connection.executed_sql())


class LanggraphEvidenceAssemblyTest(unittest.TestCase):
    def test_reconciles_matching_claims_from_two_sources(self):
        drafts = [
            EvidenceDraft(source_id='source-a', claim='Acme hired a VP of Sales', signal_type='hiring', confidence=0.6),
            EvidenceDraft(
                source_id='source-b',
                claim='Acme hired a VP of Sales in Q3',
                signal_type='hiring',
                confidence=0.5,
            ),
        ]
        sources = [{'id': 'source-a'}, {'id': 'source-b'}]
        rows = _assemble_langgraph_evidence(drafts, sources)
        self.assertEqual(len(rows), 1)
        self.assertGreater(rows[0].confidence, 0.6)

    def test_prefers_source_published_at_when_present(self):
        drafts = [
            EvidenceDraft(source_id='source-a', claim='Acme hired a VP of Sales', signal_type='hiring', confidence=0.6),
        ]
        sources = [{'id': 'source-a', 'publishedAt': datetime.date(2024, 6, 15)}]
        rows = _assemble_langgraph_evidence(drafts, sources)
        self.assertEqual(rows[0].observed_at, '2024-06-15')

    def test_prefers_datetime_published_at(self):
        drafts = [
            EvidenceDraft(source_id='source-a', claim='Acme hired a VP of Sales', signal_type='hiring', confidence=0.6),
        ]
        sources = [{'id': 'source-a', 'publishedAt': datetime.datetime(2024, 6, 15, 14, 30)}]
        rows = _assemble_langgraph_evidence(drafts, sources)
        self.assertEqual(rows[0].observed_at, '2024-06-15')


class EvidenceStageLanggraphPathTest(unittest.TestCase):
    LANGGRAPH_SOURCE_ROW = (
        'source-1',
        'https://example.test/a',
        'A Title',
        'Tim Cook is CEO of Apple Inc.',
        {'matches': [{'score': 0.9}]},
        datetime.date(2024, 1, 10),
    )

    def test_langgraph_path_reconciles_and_sets_observed_at(self):
        duplicate_drafts = [
            EvidenceDraft(source_id='source-1', claim='Tim Cook is CEO of Apple Inc.', signal_type='leadership', confidence=0.7),
            EvidenceDraft(source_id='source-1', claim='Tim Cook is CEO of Apple Inc.', signal_type='leadership', confidence=0.8),
        ]
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[self.LANGGRAPH_SOURCE_ROW],
        )
        worker = Worker(database_url='postgresql://x')

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('DASHSCOPE_API_KEY', None)
            with patch('lead_trace_worker.stages.build_evidence_graph') as mock_graph:
                mock_graph.return_value.invoke.return_value = {'drafts': duplicate_drafts}
                with patch('psycopg.connect', return_value=connection):
                    result = worker.poll_once()

        self.assertTrue(result)
        insert_calls = [
            (sql, params) for kind, sql, params in connection.actions if kind == 'execute' and sql == INSERT_EVIDENCE_SQL
        ]
        self.assertEqual(len(insert_calls), 1)
        self.assertEqual(insert_calls[0][1][7], '2024-01-10')
        self.assertNotIn(FAIL_SQL, connection.executed_sql())


class BriefStageHappyPathTest(unittest.TestCase):
    def test_brief_stage_persists_brief_notification_and_completes_run(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(2, 1, False),
            evidence_rows=[EVIDENCE_ROW],
        )
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('DASHSCOPE_API_KEY', None)
            brief_id, send_email = process_brief_stage(connection, RUN_ID, ORGANIZATION_ID)

        self.assertTrue(brief_id)
        self.assertIsNotNone(send_email)
        executed = connection.executed_sql()
        self.assertTrue(any('INSERT INTO deal_brief' in sql for sql in executed))
        self.assertTrue(any('INSERT INTO notification' in sql for sql in executed))
        self.assertTrue(any('"completedAt" = NOW()' in sql for sql in executed))

    def test_brief_already_present_skips_insert_and_completes_run(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(2, 1, True),
            evidence_rows=[EVIDENCE_ROW],
            existing_brief_id='brief-existing',
        )
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('DASHSCOPE_API_KEY', None)
            brief_id, send_email = process_brief_stage(connection, RUN_ID, ORGANIZATION_ID)

        self.assertEqual(brief_id, 'brief-existing')
        self.assertIsNone(send_email)
        executed = connection.executed_sql()
        self.assertFalse(any('INSERT INTO deal_brief' in sql for sql in executed))
        self.assertFalse(any('INSERT INTO notification' in sql for sql in executed))
        self.assertTrue(any('"completedAt" = NOW()' in sql for sql in executed))


class WorkerTransactionTest(unittest.TestCase):
    def test_claim_is_committed_before_stage_work_begins(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 0, False),
            sources_rows=[SOURCE_ROW],
        )
        fake_client = FakeModelClient(
            [json.dumps({'claims': [{'claim': 'Acme announced it raised $5 million in a new funding round.', 'signalType': 'funding', 'confidence': 0.9, 'observedAt': None}]})]
        )
        worker = Worker(database_url='postgresql://x', model_client_factory=lambda _config: fake_client)

        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-key'}):
            with patch('psycopg.connect', return_value=connection):
                worker.poll_once()

        actions = [(kind, sql) for kind, sql, _params in connection.actions]
        claim_index = actions.index(('execute', CLAIM_SQL))
        self.assertEqual(actions[claim_index + 1], ('commit', None))
        self.assertLess(claim_index + 1, actions.index(('execute', COUNTS_SQL)))

    def test_brief_ready_email_is_sent_only_after_commit(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 1, False),
            evidence_rows=[EVIDENCE_ROW],
        )
        commits_at_send: list[int] = []
        worker = Worker(database_url='postgresql://x')

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('DASHSCOPE_API_KEY', None)
            with patch(
                'lead_trace_worker.stages.send_brief_ready_email',
                side_effect=lambda **_kwargs: commits_at_send.append(connection.commit_count),
            ):
                with patch('psycopg.connect', return_value=connection):
                    worker.poll_once()

        # Sent exactly once, after the final commit that holds the brief and COMPLETE_RUN.
        self.assertEqual(commits_at_send, [connection.commit_count])
        last_commit = max(index for index, action in enumerate(connection.actions) if action[0] == 'commit')
        complete_index = max(
            index
            for index, (kind, sql, _params) in enumerate(connection.actions)
            if kind == 'execute' and '"completedAt" = NOW()' in sql
        )
        self.assertGreater(last_commit, complete_index)

    def test_brief_ready_email_failure_does_not_fail_the_run(self):
        connection = FakeConnection(
            claimed_row=CLAIMED_ROW,
            counts_row=(1, 1, False),
            evidence_rows=[EVIDENCE_ROW],
        )
        worker = Worker(database_url='postgresql://x')

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('DASHSCOPE_API_KEY', None)
            with patch('lead_trace_worker.stages.send_brief_ready_email', side_effect=RuntimeError('smtp down')):
                with patch('psycopg.connect', return_value=connection):
                    result = worker.poll_once()

        self.assertTrue(result)
        self.assertNotIn(FAIL_SQL, connection.executed_sql())
        self.assertEqual(connection.rollback_count, 0)


if __name__ == '__main__':
    unittest.main()
