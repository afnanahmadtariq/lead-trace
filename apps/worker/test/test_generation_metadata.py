import os
import unittest
from unittest.mock import patch

from lead_trace_worker.graph_brief import assemble_sections
from lead_trace_worker.llm import polish_brief
from test.test_research_quality import context, evidence


class GenerationMetadataTest(unittest.TestCase):
    def sections(self):
        return assemble_sections({'context': context(), 'evidence': [evidence()], 'sections': None, 'error': None})['sections']

    def test_missing_provider_is_explicitly_recorded_as_fallback(self):
        with patch.dict(os.environ, {}, clear=True):
            result = polish_brief(context(), self.sections(), [evidence()])
        self.assertEqual(result.generation.mode, 'fallback')
        self.assertEqual(result.generation.reason, 'not_configured')

    def test_provider_failure_does_not_claim_model_assistance(self):
        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-secret'}, clear=True), \
                patch('lead_trace_worker.llm._chat_json', side_effect=RuntimeError('Provider unavailable')):
            result = polish_brief(context(), self.sections(), [evidence()])
        self.assertEqual(result.generation.mode, 'fallback')
        self.assertEqual(result.generation.reason, 'provider_error')
        self.assertNotIn('test-secret', result.model_dump_json())

    def test_success_records_configured_provider_and_model_without_credentials(self):
        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'test-secret', 'DASHSCOPE_MODEL': 'qwen-test'}, clear=True), \
                patch('lead_trace_worker.llm._chat_json', return_value={'summary': 'Explore whether sales onboarding is a priority.', 'talking_points': ['Confirm current hiring.']}):
            result = polish_brief(context(), self.sections(), [evidence()])
        self.assertEqual(result.generation.mode, 'model_assisted')
        self.assertEqual(result.generation.provider, 'dashscope')
        self.assertEqual(result.generation.model, 'qwen-test')
        self.assertIsNone(result.generation.reason)
        self.assertNotIn('test-secret', result.model_dump_json())
