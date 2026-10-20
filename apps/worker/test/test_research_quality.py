"""Regression cases for source trust, research relevance, and brief grounding."""
import datetime
import unittest
from unittest.mock import patch

from lead_trace_worker.evidence import ExtractedClaim, filter_claims_for_source, reconcile_claims
from lead_trace_worker.extract import is_relevant_claim, rank_evidence_for_brief
from lead_trace_worker.graph_brief import _compute_urgency, assemble_sections, polish_sections
from lead_trace_worker.llm import extract_claims_with_llm, polish_brief, refine_claims
from lead_trace_worker.models import EvidenceDraft, RunContext, SourceBundle
from lead_trace_worker.stages import _prefer_source_published_at


def context(goal='meeting', company='Acme'):
    return RunContext(
        run_id='run', organization_id='org', goal=goal, created_by_id='user',
        prospect_name='Jane Doe', company_name=company, offer_name='Sales training',
        value_proposition='Develop sales managers and improve account executive onboarding.',
        sender_name='Alex Morgan',
    )


def evidence(identifier='one', claim='Acme is hiring account executives for its sales team.', **overrides):
    return {
        'id': identifier, 'claim': claim, 'confidence': 0.85, 'signal_type': 'hiring',
        'source_url': f'https://example.test/{identifier}', 'source_title': 'Acme news',
        **overrides,
    }


class IdentityAndRelevanceTest(unittest.TestCase):
    def test_brand_substring_does_not_match_another_company(self):
        self.assertFalse(is_relevant_claim(
            'Pineapple Technologies is hiring cloud engineers across Europe.',
            prospect_name='Jane Doe', company_name='Apple',
        ))

    def test_shared_company_suffix_is_not_target_identity(self):
        self.assertFalse(is_relevant_claim(
            'Another Technologies company announced a product launch today.',
            prospect_name='Jane Doe', company_name='Acme Technologies',
        ))
        self.assertTrue(is_relevant_claim(
            'Acme is hiring engineers for its enterprise division.',
            prospect_name='Jane Doe', company_name='Acme Technologies',
        ))

    def test_short_company_names_are_recognized_at_word_boundaries(self):
        self.assertTrue(is_relevant_claim(
            'IBM is hiring engineers for its cloud business.',
            prospect_name='Jane Doe', company_name='IBM',
        ))

    def test_offer_related_signal_ranks_above_generic_leadership_profile(self):
        rows = [
            evidence('profile', 'Jane Doe serves as chief executive officer at Acme.', signal_type='leadership', confidence=0.95),
            evidence('sales', 'Acme is hiring account executives and sales managers.', confidence=0.8),
        ]
        ranked = rank_evidence_for_brief(rows, context(), limit=1)
        self.assertEqual(ranked[0]['id'], 'sales')

    def test_duplicate_claims_do_not_fill_brief_slots(self):
        first = evidence()
        second = evidence('duplicate', first['claim'].upper())
        self.assertEqual(len(rank_evidence_for_brief([first, second], context())), 1)


class SourceGroundingTest(unittest.TestCase):
    def test_company_and_topic_overlap_cannot_support_invented_business_event(self):
        claims = [ExtractedClaim(
            claim='Acme acquired a new sales training business in Europe.',
            signalType='partnership', confidence=0.98,
        )]
        source = {'title': 'Acme sales', 'excerpt': 'Acme provides sales training services.', 'score': 1.0}
        self.assertEqual(filter_claims_for_source(claims, source=source, context=context()), [])

    def test_recent_article_does_not_overwrite_explicit_historical_event_date(self):
        claim = ExtractedClaim(
            claim='Acme appointed Jane Doe as chief executive officer.', signalType='leadership',
            confidence=0.8, observedAt='2015-01-01',
        )
        [dated] = _prefer_source_published_at({'publishedAt': datetime.date.today()}, [claim])
        self.assertEqual(dated.observedAt, '2015-01-01')

    def test_repeated_same_source_does_not_inflate_confidence(self):
        claim = ExtractedClaim(claim='Acme is hiring account executives.', signalType='hiring', confidence=0.6)
        rows = reconcile_claims([('source-a', [claim, claim]), ('source-a', [claim])])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].confidence, 0.6)

    def test_duplicate_of_second_source_is_only_counted_once(self):
        claim = ExtractedClaim(claim='Acme is hiring account executives.', signalType='hiring', confidence=0.6)
        rows = reconcile_claims([('source-a', [claim]), ('source-b', [claim, claim])])
        self.assertAlmostEqual(rows[0].confidence, 0.84)

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_legacy_model_extraction_also_rejects_unsupported_numbers(self, chat, enabled):
        chat.return_value = {'claims': [{
            'source_id': 'source', 'claim': 'Acme hired 50 new account executives.',
            'signal_type': 'hiring', 'confidence': 0.95,
        }]}
        sources = [SourceBundle(source_id='source', url='https://example.test', title='Acme',
                                text='Acme is hiring account executives.', score=0.9)]
        self.assertEqual(extract_claims_with_llm(context(), sources), [])

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json', return_value={'claims': []})
    def test_refinement_rejection_does_not_resurrect_discarded_claims(self, chat, enabled):
        sources = [SourceBundle(source_id='source', url='https://example.test', title='Acme',
                                text='Acme is hiring account executives.')]
        drafts = [EvidenceDraft(source_id='source', claim='Acme is hiring account executives.',
                                signal_type='hiring', confidence=0.8)]
        self.assertEqual(refine_claims(context(), sources, drafts), [])


class BriefGroundingTest(unittest.TestCase):
    def test_old_undated_and_future_events_do_not_create_urgency(self):
        today = datetime.date.today()
        rows = [
            evidence('old', observed_at=(today - datetime.timedelta(days=365)).isoformat()),
            evidence('future', observed_at=(today + datetime.timedelta(days=1)).isoformat()),
            evidence('undated'),
        ]
        self.assertEqual(_compute_urgency(rows), (0.0, 'Low'))

    def test_current_role_profile_is_not_a_recent_leadership_change(self):
        row = evidence(
            'profile', 'Jane Doe serves as chief executive officer at Acme.',
            signal_type='leadership', observed_at=datetime.date.today().isoformat(),
        )
        self.assertEqual(_compute_urgency([row]), (0.0, 'Low'))

    def test_irrelevant_rejected_rows_do_not_raise_brief_urgency(self):
        today = datetime.date.today().isoformat()
        rows = [evidence(observed_at=None)] + [
            evidence(str(i), 'OtherCorp is hiring engineers for a new division.', observed_at=today)
            for i in range(5)
        ]
        state = assemble_sections({'context': context(), 'evidence': rows, 'sections': None, 'error': None})
        self.assertEqual(state['sections'].urgency_score, 0.0)
        self.assertTrue(any('No dated public event' in gap for gap in state['sections'].gaps))

    def test_long_offer_paragraph_is_not_pasted_or_lowercased_into_fallback_copy(self):
        offer_text = (
            'We help B2B SaaS teams understand where developers get stuck during onboarding by combining '
            'SDK telemetry, support tickets, and developer feedback into actionable insights. '
            'Our analytics connects Next.js adoption to time-to-first-value without manual spreadsheet work.'
        )
        ctx = context('outreach', 'Vercel').model_copy(update={
            'prospect_name': 'Guillermo Rauch', 'offer_name': 'Developer onboarding analytics',
            'value_proposition': offer_text,
        })
        row = evidence(claim='Vercel launched a new SDK to improve the Next.js developer experience.', signal_type='launch')
        state = assemble_sections({'context': ctx, 'evidence': [row], 'sections': None, 'error': None})
        brief = state['sections']
        self.assertLess(len(brief.summary), 350)
        self.assertNotIn(offer_text.lower(), brief.summary.lower())
        self.assertNotIn('test whether we help', brief.summary.lower())
        self.assertIn('Vercel launched a new SDK', brief.outreach_draft)
        self.assertIn('Next.js', brief.outreach_draft)
        self.assertNotIn('verified', brief.summary.lower())
        self.assertNotIn('recent', brief.summary.lower())
        self.assertIn('Developer onboarding analytics', brief.outreach_draft)
        self.assertLess(len(brief.outreach_draft.split()), 120)

    @patch('lead_trace_worker.graph_brief.polish_brief')
    def test_polisher_receives_only_claims_actually_cited_by_the_brief(self, polish):
        rows = [evidence(str(i), f'Acme is hiring sales managers for region {i}.') for i in range(6)]
        state = assemble_sections({'context': context(), 'evidence': rows, 'sections': None, 'error': None})
        polish.return_value = state['sections']
        polish_sections(state)
        submitted = polish.call_args.args[2]
        self.assertEqual({row['id'] for row in submitted}, {c.evidence_id for c in state['sections'].key_signals})
        self.assertEqual(len(submitted), 5)

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_optional_model_fields_cannot_erase_required_goal_output(self, chat, enabled):
        chat.return_value = {
            'summary': 'Acme is hiring account executives; explore whether sales onboarding is a priority.',
            'talking_points': ['Ask whether sales onboarding is a priority.'],
            'questions_to_ask': [], 'outreach_draft': None,
        }
        for goal in ('meeting', 'outreach'):
            with self.subTest(goal=goal):
                ctx = context(goal)
                state = assemble_sections({'context': ctx, 'evidence': [evidence()], 'sections': None, 'error': None})
                polished = polish_brief(ctx, state['sections'], [evidence()])
                if goal == 'meeting':
                    self.assertTrue(polished.questions_to_ask)
                    self.assertIsNone(polished.outreach_draft)
                else:
                    self.assertTrue(polished.outreach_draft.endswith('Alex Morgan'))
                    self.assertEqual(polished.questions_to_ask, [])


if __name__ == '__main__':
    unittest.main()
