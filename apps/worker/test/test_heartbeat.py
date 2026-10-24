import threading
import unittest
from unittest.mock import patch

from lead_trace_worker import db
from lead_trace_worker.pipeline import HEARTBEAT_SQL


class _Cursor:
    def fetchone(self):
        return (0.03,)


class _Connection:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=()):
        self.calls.append((sql, params))
        return _Cursor()

    def commit(self):
        pass


class HeartbeatTest(unittest.TestCase):
    def test_heartbeat_extends_lease_while_stage_runs_and_stops_after(self):
        calls = []
        beaten = threading.Event()

        def connect(url):
            connection = _Connection(calls)
            original = connection.execute

            def execute(sql, params=()):
                result = original(sql, params)
                if sql == HEARTBEAT_SQL:
                    beaten.set()
                return result

            connection.execute = execute
            return connection

        worker = db.Worker('postgresql://x', worker_id='w1')
        with patch('psycopg.connect', connect), patch.object(db, 'HEARTBEAT_MIN_SECONDS', 0.01):
            with worker._heartbeat('run-1', 'org-1'):
                self.assertTrue(beaten.wait(2))
            count = sum(1 for sql, _ in calls if sql == HEARTBEAT_SQL)
            threading.Event().wait(0.1)
            self.assertEqual(count, sum(1 for sql, _ in calls if sql == HEARTBEAT_SQL))
        beat = next(params for sql, params in calls if sql == HEARTBEAT_SQL)
        self.assertEqual(beat, (worker.lock_for, 'run-1', 'org-1', 'w1'))


if __name__ == '__main__':
    unittest.main()
