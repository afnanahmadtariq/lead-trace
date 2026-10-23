import json
import unittest
from unittest.mock import patch

from lead_trace_worker.extract import numeric_quantities, rank_evidence_for_brief
from lead_trace_worker.graph_brief import assemble_sections
from lead_trace_worker.llm import polish_brief
from lead_trace_worker.models import RunContext


def context():
    return RunContext(run_id='run', organization_id='org', goal='meeting', created_by_id=None,
                      prospect_name='Guillermo Rauch', company_name='Vercel',
                      offer_name='Developer onboarding analytics',
                      value_proposition='Help developer platform teams improve onboarding workflows and product feedback.')


def row(identifier, claim, kind='funding', confidence=0.9):
    return {'id': identifier, 'claim': claim, 'signal_type': kind, 'confidence': confidence,
            'source_url': f'https://example.test/{identifier}',
            'source_title': 'Vercel raises Series F at $9.3B valuation', 'observed_at': '2025-09-01'}


class NumericGroundingTest(unittest.TestCase):
    def test_equivalent_amount_formats_match_without_losing_percent_semantics(self):
        self.assertEqual(numeric_quantities('$300M'), numeric_quantities('$300 million'))
        self.assertEqual(numeric_quantities('$9.3B'), numeric_quantities('9,300 million'))
        self.assertEqual(numeric_quantities('300,000,000'), numeric_quantities('300 million'))
        self.assertNotEqual(numeric_quantities('50%'), numeric_quantities('50'))
        self.assertNotEqual(numeric_quantities('$300M'), numeric_quantities('$9.3B'))

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_titles_cannot_authorize_numbers_and_bad_fields_fall_back(self, chat, enabled):
        rows = [row('one', 'Vercel expects its $300 million secondary tender offer to close in November 2025.')]
        ctx = context()
        original = assemble_sections({'context': ctx, 'evidence': rows, 'sections': None, 'error': None})['sections']
        invalid = 'Vercel closed the tender offer alongside a Series F at a $9.3B valuation.'
        valid = 'Vercel expects its $300M secondary tender offer to close in November 2025.'
        chat.return_value = {'summary': invalid, 'talking_points': [invalid, valid],
                             'personalized_opener': invalid, 'questions_to_ask': [invalid],
                             'next_steps': [invalid], 'objection_handling': [invalid],
                             'conversation_angles': [{'evidence_id': 'one',
                                 'why_it_matters': 'If the $9.3B valuation enables growth, onboarding analytics might be relevant.',
                                 'question': 'Does the valuation change your onboarding priorities?'}]}
        polished = polish_brief(ctx, original, rows)
        self.assertEqual(polished.summary, original.summary)
        self.assertEqual(polished.talking_points, [valid])
        self.assertEqual(polished.personalized_opener, original.personalized_opener)
        self.assertEqual(polished.questions_to_ask, original.questions_to_ask)
        self.assertEqual(polished.next_steps, original.next_steps)
        self.assertEqual(polished.objection_handling, original.objection_handling)
        self.assertEqual(polished.conversation_angles, original.conversation_angles)
        system, prompt = chat.call_args.args
        payload = json.loads(prompt)
        self.assertNotIn('source_title', payload['evidence'][0])
        self.assertNotIn('$9.3B', prompt)
        self.assertIn('A past date does not prove completion', system)

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_offer_numbers_cannot_authorize_prospect_claim_or_outreach(self, chat, enabled):
        ctx = context().model_copy(update={'goal': 'outreach', 'value_proposition': 'Our fictional product promises a 25% reduction in onboarding friction.'})
        rows = [row('one', 'Vercel released a developer onboarding guide for its platform.', 'launch')]
        original = assemble_sections({'context': ctx, 'evidence': rows, 'sections': None, 'error': None})['sections']
        chat.return_value = {'summary': 'Vercel reduced developer onboarding friction by 25% across its platform.',
                             'talking_points': ['Vercel reduced friction by 25%.'],
                             'outreach_draft': 'Hi Guillermo, Vercel reduced onboarding friction by 25%. Let us talk.'}
        polished = polish_brief(ctx, original, rows)
        self.assertEqual(polished.summary, original.summary)
        self.assertEqual(polished.outreach_draft, original.outreach_draft)


class BriefSelectionTest(unittest.TestCase):
    def test_tender_variants_share_one_slot_and_only_one_identity_anchor_survives(self):
        rows = [
            row('ceo', 'Guillermo Rauch is the chief executive officer of Vercel.', 'leadership', 0.99),
            row('cto', 'Malte Ubl is the chief technology officer of Vercel.', 'leadership', 0.98),
            row('tender-1', 'Vercel expects its $300M secondary tender offer to close in November 2025.'),
            row('tender-2', 'Vercel announced its $300 million secondary tender offer will close in November 2025.'),
            row('workflow', 'Vercel provides developer onboarding workflows and product feedback for platform teams.', 'other', 0.72),
        ]
        selected = rank_evidence_for_brief(rows, context())
        self.assertEqual(selected[0]['id'], 'workflow')
        self.assertEqual(sum(item['id'].startswith('tender-') for item in selected), 1)
        self.assertEqual(sum(item['id'] in ('ceo', 'cto') for item in selected), 1)

    def test_reuters_and_businesswire_tender_wording_share_one_event_slot(self):
        rows = [
            row('reuters', 'Vercel expects a $300 million secondary tender offer for employees, former employees, and early investors to close in November.'),
            row('businesswire', 'Vercel announced an approximately $300M secondary tender offer for certain employees, former employees, and early investors, set to close in November.'),
        ]
        self.assertEqual(len(rank_evidence_for_brief(rows, context())), 1)

    def test_trivial_company_description_does_not_duplicate_identity_anchor(self):
        rows = [
            row('ceo', 'Guillermo Rauch is the chief executive officer of Vercel.', 'leadership', 0.99),
            row('description', 'Vercel is a frontend-as-a-service platform for developers.', 'role-context', 0.9),
            row('vision', 'Vercel describes its vision as end-to-end software tools and developer analytics.', 'role-context', 0.85),
            row('workflow', 'Vercel provides developer onboarding workflows and product feedback for platform teams.', 'other', 0.72),
        ]
        selected = rank_evidence_for_brief(rows, context())
        selected_ids = {item['id'] for item in selected}
        self.assertIn('workflow', selected_ids)
        self.assertIn('vision', selected_ids)
        self.assertEqual(len(selected_ids & {'ceo', 'description'}), 1)

    def test_conflicting_amounts_are_not_silently_deduplicated(self):
        rows = [row('one', 'Vercel expects its $300M secondary tender offer to close in November 2025.'),
                row('two', 'Vercel expects its $500M secondary tender offer to close in November 2025.')]
        self.assertEqual(len(rank_evidence_for_brief(rows, context())), 2)


if __name__ == '__main__':
    unittest.main()
