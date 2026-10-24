import unittest
from unittest.mock import patch

from lead_trace_worker.evidence import ExtractedClaim, filter_claims_for_source
from lead_trace_worker.extract import extract_claims, is_junk_claim
from lead_trace_worker.llm import extract_claims_with_llm, fallback_claims
from lead_trace_worker.models import RunContext, SourceBundle


class FaqEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.context = RunContext(
            run_id='run', organization_id='org', goal='meeting', created_by_id='user',
            prospect_name='Jonathan Windham', company_name='Blackhawk Digital Marketing',
            offer_name='Sales platform', value_proposition='Prepare relevant sales conversations.',
        )
        self.question = 'What is Jonathan Windham’s role at Blackhawk Digital Marketing?'
        self.answer = 'Jonathan Windham is Head of Sales at Blackhawk Digital Marketing.'

    def source(self, text):
        return SourceBundle(source_id='faq', url='https://example.test/faq', title='Company FAQ', text=text, score=0.9)

    def test_question_never_becomes_fallback_evidence(self):
        for text in [self.question, self.question.rstrip('?'), 'Q: ' + self.question]:
            with self.subTest(text=text):
                self.assertTrue(is_junk_claim(text))
                self.assertEqual(fallback_claims(self.context, [self.source(text)]), [])

    def test_stated_answer_is_retained_without_its_question(self):
        claims = extract_claims(
            self.question + ' ' + self.answer,
            prospect_name=self.context.prospect_name, company_name=self.context.company_name,
        )
        self.assertEqual([claim.claim for claim in claims], [self.answer])

    def test_model_cannot_paraphrase_an_unanswered_question_as_a_fact(self):
        claim = ExtractedClaim(claim='Jonathan Windham’s role at Blackhawk Digital Marketing.', signalType='role-context', confidence=0.9)
        self.assertEqual(filter_claims_for_source(
            [claim], source={'title': self.question, 'excerpt': self.question, 'score': 0.9}, context=self.context,
        ), [])

    def test_model_answer_remains_grounded_in_the_stated_answer(self):
        claims = filter_claims_for_source(
            [ExtractedClaim(claim=self.answer, signalType='role-context', confidence=0.9)],
            source={'title': 'Company FAQ', 'excerpt': self.question + ' ' + self.answer, 'score': 0.9}, context=self.context,
        )
        self.assertEqual([claim.claim for claim in claims], [self.answer])

    @patch('lead_trace_worker.llm.llm_enabled', return_value=True)
    @patch('lead_trace_worker.llm._chat_json')
    def test_legacy_model_path_rejects_questions_too(self, chat, enabled):
        chat.return_value = {'claims': [{'source_id': 'faq', 'claim': self.question, 'signal_type': 'role-context', 'confidence': 0.9}]}
        self.assertEqual(extract_claims_with_llm(self.context, [self.source(self.question)]), [])

    def test_legitimate_person_names_and_embedded_product_questions_are_retained(self):
        for text in ['Will Smith leads the sales team at Acme Software.', 'Acme launched the “What next?” platform for sales teams.']:
            with self.subTest(text=text):
                self.assertFalse(is_junk_claim(text))
