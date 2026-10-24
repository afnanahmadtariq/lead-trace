import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from lead_trace_worker.db import Worker
from lead_trace_worker.environment import load_environment
from lead_trace_worker.llm import llm_enabled, resolve_llm_config


class EnvironmentTest(unittest.TestCase):
    def test_provider_settings_load_even_when_database_url_was_exported(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('DASHSCOPE_API_KEY="local-test-key"\nDASHSCOPE_MODEL=qwen-test\nWORKER_POLL_SECONDS=7\n')
            with patch.dict(os.environ, {'DATABASE_URL': 'postgresql://localhost/example?schema=public'}, clear=True), \
                    patch('lead_trace_worker.db.load_environment', side_effect=lambda: load_environment([path])):
                worker = Worker.from_env()
                self.assertEqual(worker.database_url, 'postgresql://localhost/example')
                self.assertTrue(llm_enabled())
                self.assertEqual(resolve_llm_config().model, 'qwen-test')
                self.assertEqual(os.environ['WORKER_POLL_SECONDS'], '7')

    def test_exported_values_win_and_nearer_file_precedes_shared_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            local = Path(directory) / 'local.env'
            shared = Path(directory) / 'shared.env'
            local.write_text('DASHSCOPE_API_KEY=local-test-key\nDASHSCOPE_MODEL=local-model\n')
            shared.write_text('DASHSCOPE_API_KEY=shared-test-key\nDASHSCOPE_BASE_URL="https://provider.example/v1" # comment\n')
            with patch.dict(os.environ, {'DASHSCOPE_MODEL': 'exported-model'}, clear=True):
                load_environment([local, shared])
                self.assertEqual(os.environ['DASHSCOPE_API_KEY'], 'local-test-key')
                self.assertEqual(os.environ['DASHSCOPE_MODEL'], 'exported-model')
                self.assertEqual(os.environ['DASHSCOPE_BASE_URL'], 'https://provider.example/v1')

    def test_missing_files_do_not_require_provider_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            load_environment([Path('/does-not-exist/worker.env')])
            self.assertFalse(llm_enabled())
