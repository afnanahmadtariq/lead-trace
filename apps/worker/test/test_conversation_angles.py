import unittest
from unittest.mock import patch

from pydantic import ValidationError

from lead_trace_worker.graph_brief import assemble_sections, citation_gate
from lead_trace_worker.llm import polish_brief
from lead_trace_worker.models import BriefSections, ConversationAngle, RunContext


def make_context(goal='meeting'):
    return RunContext(run_id='run', organization_id='org', goal=goal, created_by_id=None,
                      prospect_name='Jane Doe', company_name='Acme', offer_name='Developer onboarding analytics',
                      value_proposition='Find where developers get stuck before their first successful deployment.')


def signal(index=1):
    return {'id': f'evidence-{index}', 'claim': f'Acme launched a developer SDK for product {index}.',
            'signal_type': 'launch', 'confidence': 0.9, 'source_url': f'https://example.test/{index}',
            'source_title': 'Acme product news'}


def state(rows=None, goal='meeting'):
    return assemble_sections({'context': make_context(goal), 'evidence': rows if rows is not None else [signal()],
                              'sections': None, 'error': None})


def angle(evidence_id='evidence-1', why=None):
    return ConversationAngle(
        evidence_id=evidence_id,
        why_it_matters=why or 'If the SDK introduces a new onboarding path, analytics could help validate where developers need guidance.',
        question='Does this SDK introduce an onboarding path your team wants to measure?',
    )


class ConversationAnglesTest(unittest.TestCase):
    def test_old_briefs_without_angles_still_validate(self):
        brief = BriefSections(summary='Existing brief', key_signals=[], talking_points=[])
        self.assertEqual(brief.conversation_angles, [])

    def test_at_most_three_angles_are_allowed(self):
        with self.assertRaises(ValidationError):
            BriefSections(summary='Brief', key_signals=[], talking_points=[],
                          conversation_angles=[angle() for _ in range(4)])

    def test_both_goals_get_conditional_angles_tied_to_cited_signals(self):
        for goal in ('meeting', 'outreach'):
            with self.subTest(goal=goal):
                assembled = state([signal(i) for i in range(5)], goal)
                brief = assembled['sections']
                self.assertEqual(len(brief.conversation_angles), 3)
                cited_ids = {citation.evidence_id for citation in brief.key_signals}
                for item in brief.conversation_angles:
                    self.assertIn(item.evidence_id, cited_ids)
                    self.assertTrue(item.why_it_matters.startswith('If '))
                    self.assertIn('Developer onboarding analytics', item.why_it_matters)
                self.assertIsNone(citation_gate(assembled)['error'])

    def test_no_evidence_produces_no_angles(self):
        assembled = state([])
        self.assertEqual(assembled['sections'].conversation_angles, [])
        self.assertIsNone(citation_gate(assembled)['error'])

    def test_gate_rejects_dangling_and_stored_but_uncited_evidence_ids(self):
        assembled = state([signal(i) for i in range(6)])
        cited_ids = {citation.evidence_id for citation in assembled['sections'].key_signals}
        uncited = next(row['id'] for row in assembled['evidence'] if row['id'] not in cited_ids)
        for invalid_id in ('missing-evidence', uncited):
            with self.subTest(invalid_id=invalid_id):
                invalid = {**assembled, 'sections': assembled['sections'].model_copy(
                    update={'conversation_angles': [angle(invalid_id)]})}
                self.assertIn('uncited conversation angle', citation_gate(invalid)['error'])

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_polisher_accepts_valid_specific_angle_and_keeps_original_claim(self, chat, enabled):
        assembled = state()
        chat.return_value = {'summary': 'Acme launched an SDK; validate how it affects developer onboarding.',
                             'talking_points': ['Explore whether SDK onboarding needs measurement.'],
                             'conversation_angles': [angle().model_dump()]}
        polished = polish_brief(assembled['context'], assembled['sections'], assembled['evidence'])
        self.assertEqual(polished.conversation_angles, [angle()])
        self.assertEqual(polished.key_signals, assembled['sections'].key_signals)
        self.assertIsNone(citation_gate({**assembled, 'sections': polished})['error'])

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_polisher_discards_invalid_ids_and_asserted_pain_before_completion(self, chat, enabled):
        assembled = state([signal(i) for i in range(6)])
        cited_ids = {citation.evidence_id for citation in assembled['sections'].key_signals}
        uncited = next(row['id'] for row in assembled['evidence'] if row['id'] not in cited_ids)
        first_id = assembled['sections'].key_signals[0].evidence_id
        chat.return_value = {'summary': 'Acme launched an SDK; validate how it affects developer onboarding.',
                             'talking_points': ['Explore whether SDK onboarding needs measurement.'],
                             'conversation_angles': [angle('missing').model_dump(), angle(uncited).model_dump(),
                                                     angle(first_id, 'Acme has an onboarding crisis and needs this product now.').model_dump()]}
        polished = polish_brief(assembled['context'], assembled['sections'], assembled['evidence'])
        self.assertEqual(polished.conversation_angles, assembled['sections'].conversation_angles)
        self.assertIsNone(citation_gate({**assembled, 'sections': polished})['error'])


if __name__ == '__main__':
    unittest.main()
