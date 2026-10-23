import unittest

from lead_trace_worker.extract import classify_sentence, extract_claims, is_junk_claim, is_relevant_claim, merge_claim_lists
from lead_trace_worker.llm import (
    DEFAULT_DASHSCOPE_BASE_URL,
    fallback_claims,
    llm_enabled,
    personalize_outreach_draft,
    resolve_llm_config,
)
from lead_trace_worker.models import SourceBundle
from lead_trace_worker.tavily import build_discovery_queries, tavily_configured
from lead_trace_worker.graph_brief import build_brief_graph, citation_gate, new_id
from lead_trace_worker.models import BriefCitation, BriefSections, RunContext


class TavilyTest(unittest.TestCase):
    def test_builds_bounded_discovery_queries(self):
        queries = build_discovery_queries('Jane Doe', 'Northstar', 'northstar.io')
        self.assertGreaterEqual(len(queries), 2)
        joined = ' '.join(item['query'] for item in queries)
        self.assertIn('Jane Doe', joined)
        self.assertIn('Northstar', joined)


class LlmTest(unittest.TestCase):
    def test_llm_disabled_without_keys(self):
        import os

        saved = {key: os.environ.pop(key, None) for key in ('OPENAI_API_KEY', 'DASHSCOPE_API_KEY')}
        try:
            self.assertFalse(llm_enabled())
        finally:
            for key, value in saved.items():
                if value is not None:
                    os.environ[key] = value

    def test_fallback_claims_from_sources(self):
        from lead_trace_worker.models import RunContext

        context = RunContext(
            run_id='run',
            organization_id='org',
            goal='meeting',
            created_by_id='user',
            prospect_name='Tim Cook',
            company_name='Apple',
            offer_name='Platform',
            value_proposition='Better conversations.',
        )
        sources = [
            SourceBundle(
                source_id='src-1',
                url='https://example.com/cook',
                title='Example',
                text='Timothy Donald Cook is the chief executive officer of Apple Inc.',
                score=0.9,
            )
        ]
        drafts = fallback_claims(context, sources, limit=2)
        self.assertTrue(drafts)
        self.assertIn('Cook', drafts[0].claim)

    def test_openai_configuration_uses_openai_endpoint_and_model(self):
        from unittest.mock import patch

        with patch.dict(
            'os.environ',
            {
                'OPENAI_API_KEY': 'openai-key',
                'OPENAI_BASE_URL': 'https://gateway.example/v1',
                'OPENAI_MODEL': 'gpt-test',
                'DASHSCOPE_API_KEY': 'dashscope-key',
            },
            clear=True,
        ):
            config = resolve_llm_config()

        self.assertEqual(config.api_key, 'openai-key')
        self.assertEqual(config.base_url, 'https://gateway.example/v1')
        self.assertEqual(config.model, 'gpt-test')

    def test_dashscope_configuration_uses_dashscope_endpoint_and_model(self):
        from unittest.mock import patch

        with patch.dict('os.environ', {'DASHSCOPE_API_KEY': 'dashscope-key'}, clear=True):
            config = resolve_llm_config()

        self.assertEqual(config.api_key, 'dashscope-key')
        self.assertEqual(config.base_url, DEFAULT_DASHSCOPE_BASE_URL)
        self.assertEqual(config.model, 'qwen3.8-max')

    def test_legacy_model_override_remains_supported_per_provider(self):
        from unittest.mock import patch

        with patch.dict(
            'os.environ',
            {'DASHSCOPE_API_KEY': 'dashscope-key', 'WORKER_LLM_MODEL': 'qwen-legacy'},
            clear=True,
        ):
            config = resolve_llm_config()

        self.assertEqual(config.model, 'qwen-legacy')

    def test_outreach_uses_sender_name_instead_of_placeholder(self):
        draft = 'Hi Jane,\n\nWorth a conversation?\n\nBest,\n[Your Name]'

        personalized = personalize_outreach_draft(draft, 'Alex Morgan')

        self.assertIsNotNone(personalized)
        self.assertNotIn('[Your Name]', personalized or '')
        self.assertTrue((personalized or '').endswith('Best,\nAlex Morgan'))


class ExtractTest(unittest.TestCase):
    def test_classifies_hiring_sentence(self):
        self.assertEqual(
            classify_sentence('Northstar is hiring senior account executives across two regions.'),
            'hiring',
        )

    def test_extracts_bounded_claim_for_named_prospect(self):
        text = (
            'Satya Nadella leads Microsoft as chief executive officer. '
            'Microsoft is hiring cloud engineers in Seattle. '
            'Short.'
        )
        claims = extract_claims(text, prospect_name='Satya Nadella', company_name='Microsoft', source_score=0.8)
        self.assertTrue(claims)
        self.assertLessEqual(len(claims), 3)
        self.assertGreaterEqual(claims[0].confidence, 0.55)
        self.assertTrue(any('Nadella' in claim.claim or 'Microsoft' in claim.claim for claim in claims))

    def test_rejects_fruit_and_boilerplate_noise(self):
        text = (
            'An apple is the round, edible fruit of an apple tree. '
            'Or call 1-800-MY-APPLE (1-800-692-7753). '
            'Timothy Donald Cook is the chief executive officer of Apple Inc.'
        )
        claims = extract_claims(text, prospect_name='Tim Cook', company_name='Apple', source_score=0.8)
        joined = ' '.join(claim.claim for claim in claims)
        self.assertNotIn('edible fruit', joined.lower())
        self.assertNotIn('1-800', joined)
        self.assertIn('Cook', joined)

    def test_merge_deduplicates_claims(self):
        first = extract_claims('Microsoft is hiring cloud engineers in Seattle.', prospect_name='Tim Cook', company_name='Microsoft')
        second = extract_claims('Microsoft is hiring cloud engineers in Seattle.', prospect_name='Tim Cook', company_name='Microsoft')
        merged = merge_claim_lists([first, second], limit=5)
        self.assertEqual(len(merged), 1)

    def test_rejects_linkedin_activity_and_truncated_fragments(self):
        self.assertTrue(is_junk_claim('For a while.… Liked by Taha Ashfaq View Post Activity Image'))
        self.assertTrue(is_junk_claim('Taha is a UX/UI Designer at Adasight and a'))
        self.assertTrue(
            is_junk_claim('# Danyal Rana Software Engineer 44 connections, 50 followers ## About N/A')
        )

    def test_signal_keyword_without_target_identity_is_not_relevant(self):
        self.assertFalse(
            is_relevant_claim(
                'Another company is hiring account executives across Europe.',
                prospect_name='Jane Doe',
                company_name='Acme',
            )
        )


class BriefGateTest(unittest.TestCase):
    def test_rejects_uncited_evidence_id(self):
        context = RunContext(
            run_id='run',
            organization_id='org',
            goal='meeting',
            created_by_id='user',
            prospect_name='Jane Doe',
            company_name='Acme',
            offer_name='Platform',
            value_proposition='Better conversations.',
        )
        evidence = [
            {
                'id': 'evidence-1',
                'claim': 'Acme opened a new regional office.',
                'signal_type': 'launch',
                'confidence': 0.8,
                'source_url': 'https://example.com/acme',
                'source_title': 'Example',
            }
        ]
        assembled = build_brief_graph().invoke({'context': context, 'evidence': evidence, 'sections': None, 'error': None})
        sections = assembled['sections']
        self.assertIsNotNone(sections)
        tampered = sections.model_copy(
            update={
                'key_signals': sections.key_signals + [
                    BriefCitation(
                        evidence_id='missing',
                        claim='Fake claim',
                        source_url='https://example.com/fake',
                        signal_type='other',
                    )
                ]
            }
        )
        gated = citation_gate({'context': context, 'evidence': evidence, 'sections': tampered, 'error': None})
        self.assertIn('unresolved evidence id', gated['error'] or '')

    def test_rejects_tampered_source_url(self):
        context = RunContext(
            run_id='run',
            organization_id='org',
            goal='meeting',
            created_by_id='user',
            prospect_name='Jane Doe',
            company_name='Acme',
            offer_name='Platform',
            value_proposition='Better conversations.',
        )
        evidence = [
            {
                'id': 'evidence-1',
                'claim': 'Acme opened a new regional office.',
                'signal_type': 'launch',
                'confidence': 0.8,
                'source_url': 'https://example.com/acme',
                'source_title': 'Example',
            }
        ]
        assembled = build_brief_graph().invoke({'context': context, 'evidence': evidence, 'sections': None, 'error': None})
        sections = assembled['sections']
        self.assertIsNotNone(sections)
        tampered = sections.model_copy(
            update={
                'key_signals': [
                    sections.key_signals[0].model_copy(update={'source_url': 'https://example.com/fake'})
                ]
            }
        )
        gated = citation_gate({'context': context, 'evidence': evidence, 'sections': tampered, 'error': None})
        self.assertIn('source_url mismatch', gated['error'] or '')

    def test_thin_evidence_populates_gaps(self):
        context = RunContext(
            run_id='run',
            organization_id='org',
            goal='meeting',
            created_by_id='user',
            prospect_name='Jane Doe',
            company_name='Acme',
            offer_name='Platform',
            value_proposition='Better conversations.',
        )
        evidence = [
            {
                'id': new_id(),
                'claim': 'Acme is hiring enterprise account executives in Austin.',
                'signal_type': 'hiring',
                'confidence': 0.82,
                'source_url': 'https://example.com/acme',
                'source_title': 'Example',
            }
        ]
        result = build_brief_graph().invoke({'context': context, 'evidence': evidence, 'sections': None, 'error': None})
        self.assertIsNone(result['error'])
        sections = BriefSections.model_validate(result['sections'].model_dump())
        self.assertTrue(any('preliminary' in gap.lower() for gap in sections.gaps))

    def test_filtered_evidence_states_gap(self):
        context = RunContext(
            run_id='run',
            organization_id='org',
            goal='meeting',
            created_by_id='user',
            prospect_name='Jane Doe',
            company_name='Acme',
            offer_name='Platform',
            value_proposition='Better conversations.',
        )
        evidence = [
            {
                'id': new_id(),
                'claim': 'An apple is the round, edible fruit of an apple tree.',
                'signal_type': 'other',
                'confidence': 0.9,
                'source_url': 'https://example.com/fruit',
                'source_title': 'Fruit',
            }
        ]
        result = build_brief_graph().invoke({'context': context, 'evidence': evidence, 'sections': None, 'error': None})
        self.assertIsNone(result['error'])
        sections = BriefSections.model_validate(result['sections'].model_dump())
        self.assertEqual(sections.key_signals, [])
        self.assertTrue(any('failed relevance' in gap.lower() for gap in sections.gaps))

    def test_generates_meeting_sections(self):
        context = RunContext(
            run_id='run',
            organization_id='org',
            goal='meeting',
            created_by_id='user',
            prospect_name='Jane Doe',
            company_name='Acme',
            offer_name='Platform',
            value_proposition='Better conversations.',
        )
        evidence = [
            {
                'id': new_id(),
                'claim': 'Acme is hiring enterprise account executives in Austin.',
                'signal_type': 'hiring',
                'confidence': 0.82,
                'source_url': 'https://example.com/acme',
                'source_title': 'Example',
            }
        ]
        result = build_brief_graph().invoke({'context': context, 'evidence': evidence, 'sections': None, 'error': None})
        self.assertIsNone(result['error'])
        sections = BriefSections.model_validate(result['sections'].model_dump())
        self.assertTrue(sections.summary)
        self.assertEqual(len(sections.key_signals), 1)
        self.assertTrue(sections.questions_to_ask)
        self.assertTrue(sections.personalized_opener)
        self.assertTrue(sections.objection_handling)
        self.assertTrue(sections.next_steps)

    def test_generated_outreach_is_signed_with_profile_name(self):
        context = RunContext(
            run_id='run', organization_id='org', goal='outreach', created_by_id='user',
            prospect_name='Jane Doe', company_name='Acme', offer_name='Platform',
            value_proposition='Improve sales research quality and reduce preparation time.',
            sender_name='Alex Morgan',
        )
        evidence = [{
            'id': new_id(), 'claim': 'Acme is hiring enterprise account executives in Austin.',
            'signal_type': 'hiring', 'confidence': 0.82, 'source_url': 'https://example.com/acme',
            'source_title': 'Example',
        }]

        result = build_brief_graph().invoke(
            {'context': context, 'evidence': evidence, 'sections': None, 'error': None}
        )
        sections = BriefSections.model_validate(result['sections'].model_dump())

        self.assertIsNotNone(sections.outreach_draft)
        self.assertTrue((sections.outreach_draft or '').endswith('Best,\nAlex Morgan'))
        self.assertNotIn('[Your Name]', sections.outreach_draft or '')

    def test_seller_intent_is_not_copied_into_buyer_questions(self):
        context = RunContext(
            run_id='run', organization_id='org', goal='meeting', created_by_id='user',
            prospect_name='Jane Doe', company_name='Acme', offer_name='Platform',
            value_proposition='I need to get her to buy my SaaS tool.',
        )
        evidence = [{
            'id': new_id(), 'claim': 'Acme is hiring enterprise account executives in Austin.',
            'signal_type': 'hiring', 'confidence': 0.82, 'source_url': 'https://example.com/acme',
            'source_title': 'Example',
        }]

        result = build_brief_graph().invoke(
            {'context': context, 'evidence': evidence, 'sections': None, 'error': None}
        )
        sections = BriefSections.model_validate(result['sections'].model_dump())
        rendered = ' '.join([sections.summary, *sections.questions_to_ask, *sections.gaps]).lower()
        self.assertNotIn('get her to buy', rendered)
        self.assertTrue(any('buyer outcome' in gap.lower() for gap in sections.gaps))


if __name__ == '__main__':
    unittest.main()
