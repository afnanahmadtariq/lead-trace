import unittest

from pydantic import ValidationError

from lead_trace_worker.evidence import (
    MAX_CLAIMS_PER_SOURCE,
    SAME_FACT_OVERLAP_THRESHOLD,
    SIGNAL_TYPES,
    EvidenceRow,
    ExtractedClaim,
    SourceClaims,
    _boost_confidence,
    _extract_numeric_tokens,
    _is_same_fact,
    _normalize_claim_text,
    _prefer_observed_at,
    assemble_evidence_rows,
    build_extraction_prompt,
    filter_claims_for_source,
    reconcile_claims,
)
from lead_trace_worker.models import RunContext


def _claim(claim: str, signal_type: str = 'hiring', confidence: float = 0.5, observed_at=None) -> ExtractedClaim:
    return ExtractedClaim(claim=claim, signalType=signal_type, confidence=confidence, observedAt=observed_at)


class SignalTypesTest(unittest.TestCase):
    def test_signal_types_is_the_closed_spec_set(self):
        self.assertEqual(
            SIGNAL_TYPES,
            frozenset({'hiring', 'funding', 'launch', 'leadership', 'partnership', 'role-context', 'other'}),
        )


class SameFactOverlapThresholdTest(unittest.TestCase):
    def test_threshold_is_the_named_constant(self):
        self.assertEqual(SAME_FACT_OVERLAP_THRESHOLD, 0.6)


class ExtractedClaimValidationTest(unittest.TestCase):
    def test_confidence_above_one_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            ExtractedClaim(claim='Acme hired a VP of Sales', signalType='hiring', confidence=1.5)

    def test_confidence_below_zero_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            ExtractedClaim(claim='Acme hired a VP of Sales', signalType='hiring', confidence=-0.1)

    def test_unknown_signal_type_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            ExtractedClaim(claim='Acme hired a VP of Sales', signalType='not-a-real-type', confidence=0.5)

    def test_empty_claim_text_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            ExtractedClaim(claim='', signalType='hiring', confidence=0.5)

    def test_valid_claim_constructs(self):
        claim = _claim('Acme hired a VP of Sales', confidence=0.6)
        self.assertEqual(claim.claim, 'Acme hired a VP of Sales')
        self.assertEqual(claim.signalType, 'hiring')
        self.assertEqual(claim.confidence, 0.6)
        self.assertIsNone(claim.observedAt)


class ExtractedClaimObservedAtValidationTest(unittest.TestCase):
    def test_valid_iso_date_is_preserved(self):
        claim = _claim('Acme hired a VP of Sales', observed_at='2024-06-15')
        self.assertEqual(claim.observedAt, '2024-06-15')

    def test_garbage_date_becomes_none_instead_of_raising(self):
        claim = _claim('Acme hired a VP of Sales', observed_at='Q3 2024')
        self.assertIsNone(claim.observedAt)

    def test_blank_string_becomes_none(self):
        claim = _claim('Acme hired a VP of Sales', observed_at='')
        self.assertIsNone(claim.observedAt)

    def test_missing_observed_at_stays_none(self):
        claim = _claim('Acme hired a VP of Sales')
        self.assertIsNone(claim.observedAt)


class SourceClaimsMaxLengthTest(unittest.TestCase):
    def test_more_than_max_claims_per_source_fails_validation(self):
        claims_payload = [
            {'claim': f'Claim number {index}', 'signalType': 'hiring', 'confidence': 0.5, 'observedAt': None}
            for index in range(MAX_CLAIMS_PER_SOURCE + 1)
        ]
        with self.assertRaises(ValidationError):
            SourceClaims(claims=claims_payload)

    def test_exactly_max_claims_per_source_is_valid(self):
        claims_payload = [
            {'claim': f'Claim number {index}', 'signalType': 'hiring', 'confidence': 0.5, 'observedAt': None}
            for index in range(MAX_CLAIMS_PER_SOURCE)
        ]
        result = SourceClaims(claims=claims_payload)
        self.assertEqual(len(result.claims), MAX_CLAIMS_PER_SOURCE)


class BuildExtractionPromptTest(unittest.TestCase):
    def test_returns_system_and_user_prompt_mentioning_source_fields_and_signal_types(self):
        source = {
            'id': 'src-1',
            'url': 'https://example.test/article',
            'title': 'Acme raises Series B',
            'publisher': 'Example News',
            'excerpt': 'Acme announced a $20M Series B round led by Example Ventures.',
        }
        system_prompt, user_prompt = build_extraction_prompt(source)
        self.assertIsInstance(system_prompt, str)
        self.assertIsInstance(user_prompt, str)
        for signal_type in SIGNAL_TYPES:
            self.assertIn(signal_type, system_prompt)
        self.assertIn(source['excerpt'], user_prompt)
        self.assertIn(source['title'], user_prompt)

    def test_context_prompt_names_the_target_and_rejects_social_fragments(self):
        context = RunContext(
            run_id='run', organization_id='org', goal='meeting', created_by_id='user',
            prospect_name='Taha Ashfaq', company_name='Adasight', offer_name='Platform',
            value_proposition='Improve design workflows for product teams.',
        )
        system_prompt, _ = build_extraction_prompt(
            {'url': 'https://example.test', 'title': 'Profile', 'publisher': 'Example', 'excerpt': 'Text'},
            context,
        )
        self.assertIn('Taha Ashfaq', system_prompt)
        self.assertIn('Adasight', system_prompt)
        self.assertIn('social activity labels', system_prompt)


class FilterClaimsForSourceTest(unittest.TestCase):
    def setUp(self):
        self.context = RunContext(
            run_id='run', organization_id='org', goal='meeting', created_by_id='user',
            prospect_name='Taha Ashfaq', company_name='Adasight', offer_name='Platform',
            value_proposition='Improve design workflows for product teams.',
        )

    def test_rejects_activity_fragment_even_when_model_is_highly_confident(self):
        source = {
            'title': 'Taha Ashfaq profile',
            'excerpt': 'For a while.… Liked by Taha Ashfaq View Post Activity Image',
        }
        claims = [_claim('For a while.… Liked by Taha Ashfaq View Post Activity Image', confidence=0.97)]
        self.assertEqual(filter_claims_for_source(claims, source=source, context=self.context), [])

    def test_rejects_claim_with_numeric_detail_absent_from_source(self):
        source = {
            'title': 'Adasight case study',
            'excerpt': 'Adasight improved the onboarding experience for customers.',
        }
        claims = [_claim('Adasight improved onboarding conversion by 25 percent.', confidence=0.9)]
        self.assertEqual(filter_claims_for_source(claims, source=source, context=self.context), [])

    def test_keeps_supported_target_claim_and_caps_single_source_confidence(self):
        source = {
            'title': 'Adasight case study',
            'excerpt': 'Adasight improved onboarding conversion by 5% for a customer.',
            'score': 1.0,
        }
        claims = [_claim('Adasight improved onboarding conversion by 5% for a customer.', confidence=0.97)]
        [filtered] = filter_claims_for_source(claims, source=source, context=self.context)
        self.assertEqual(filtered.confidence, 0.9)


class NormalizeClaimTextTest(unittest.TestCase):
    def test_lowercases_strips_and_collapses_whitespace(self):
        self.assertEqual(_normalize_claim_text('  Acme   Hired  a VP  '), 'acme hired a vp')

    def test_strips_trailing_punctuation(self):
        self.assertEqual(_normalize_claim_text('Acme hired a VP of Sales.'), 'acme hired a vp of sales')
        self.assertEqual(_normalize_claim_text('Acme hired a VP of Sales!'), 'acme hired a vp of sales')
        self.assertEqual(_normalize_claim_text('Acme hired a VP of Sales?'), 'acme hired a vp of sales')
        self.assertEqual(_normalize_claim_text('Acme hired a VP of Sales,'), 'acme hired a vp of sales')


class ExtractNumericTokensTest(unittest.TestCase):
    def test_extracts_dollar_amount_with_unit_letter(self):
        self.assertEqual(_extract_numeric_tokens('acme raised $20m series b'), {'$20m'})

    def test_extracts_percent_comma_and_decimal_tokens(self):
        self.assertEqual(_extract_numeric_tokens('grew 50% to 1,200 users in 3.5 years'), {'50%', '1,200', '3.5'})

    def test_no_numeric_tokens_returns_empty_set(self):
        self.assertEqual(_extract_numeric_tokens('acme hired a vp of sales'), set())

    def test_digit_embedded_in_a_word_is_not_treated_as_numeric(self):
        self.assertEqual(_extract_numeric_tokens('acme hired a vp of sales in q3'), set())


class IsSameFactTest(unittest.TestCase):
    def test_different_signal_types_are_never_the_same_fact(self):
        a = _claim('Acme hired a VP of Sales', signal_type='hiring')
        b = _claim('Acme hired a VP of Sales', signal_type='funding')
        self.assertFalse(_is_same_fact(a, b))

    def test_near_identical_text_same_signal_type_is_the_same_fact(self):
        a = _claim('Acme hired a VP of Sales', signal_type='hiring')
        b = _claim('Acme hired a VP of Sales in Q3', signal_type='hiring')
        self.assertTrue(_is_same_fact(a, b))

    def test_unrelated_text_same_signal_type_is_not_the_same_fact(self):
        a = _claim('Acme hired a VP of Sales', signal_type='hiring')
        b = _claim('Acme raised a Series B', signal_type='hiring')
        self.assertFalse(_is_same_fact(a, b))

    def test_conflicting_numeric_details_are_never_the_same_fact_despite_high_word_overlap(self):
        a = _claim('Acme raised $20M Series B', signal_type='funding')
        b = _claim('Acme raised $50M Series B', signal_type='funding')
        self.assertFalse(_is_same_fact(a, b))


class BoostConfidenceTest(unittest.TestCase):
    def test_boost_increases_confidence(self):
        self.assertGreater(_boost_confidence(0.5, 0.5), 0.5)

    def test_boost_never_exceeds_one(self):
        self.assertLessEqual(_boost_confidence(0.95, 0.9), 1.0)

    def test_boost_never_decreases(self):
        self.assertGreaterEqual(_boost_confidence(0.5, 0.0), 0.5)


class ReconcileClaimsTest(unittest.TestCase):
    def test_spec1_rows_carry_a_real_input_source_id(self):
        claims_by_source = [
            ('source-a', [_claim('Acme hired a VP of Sales', signal_type='hiring')]),
            ('source-b', [_claim('Acme raised a Series B', signal_type='funding')]),
        ]
        rows = reconcile_claims(claims_by_source)
        self.assertEqual(len(rows), 2)
        for row in rows:
            self.assertIn(row.source_id, {'source-a', 'source-b'})
            self.assertTrue(row.source_id)

    def test_spec4_matching_claims_from_two_sources_boost_confidence_into_one_row(self):
        claims_by_source = [
            ('source-a', [_claim('Acme hired a VP of Sales', signal_type='hiring', confidence=0.6)]),
            ('source-b', [_claim('Acme hired a VP of Sales in Q3', signal_type='hiring', confidence=0.5)]),
        ]
        rows = reconcile_claims(claims_by_source)
        self.assertEqual(len(rows), 1)
        self.assertGreater(rows[0].confidence, 0.6)
        self.assertGreater(rows[0].confidence, 0.5)
        self.assertEqual(rows[0].source_id, 'source-a')

    def test_spec4_unrelated_claims_from_two_sources_stay_separate_and_unaveraged(self):
        claims_by_source = [
            ('source-a', [_claim('Acme hired a VP of Sales', signal_type='hiring', confidence=0.6)]),
            ('source-b', [_claim('Acme raised a Series B', signal_type='hiring', confidence=0.5)]),
        ]
        rows = reconcile_claims(claims_by_source)
        self.assertEqual(len(rows), 2)
        confidences = {row.claim: row.confidence for row in rows}
        self.assertEqual(confidences['Acme hired a VP of Sales'], 0.6)
        self.assertEqual(confidences['Acme raised a Series B'], 0.5)

    def test_conflicting_numeric_details_from_two_sources_stay_separate_and_unaveraged(self):
        claims_by_source = [
            ('source-a', [_claim('Acme raised $20M Series B', signal_type='funding', confidence=0.6)]),
            ('source-b', [_claim('Acme raised $50M Series B', signal_type='funding', confidence=0.5)]),
        ]
        rows = reconcile_claims(claims_by_source)
        self.assertEqual(len(rows), 2)
        confidences = {row.claim: row.confidence for row in rows}
        self.assertEqual(confidences['Acme raised $20M Series B'], 0.6)
        self.assertEqual(confidences['Acme raised $50M Series B'], 0.5)

    def test_merge_prefers_non_null_observed_at(self):
        claims_by_source = [
            ('source-a', [_claim('Acme hired a VP of Sales', signal_type='hiring', confidence=0.6, observed_at=None)]),
            (
                'source-b',
                [_claim('Acme hired a VP of Sales in Q3', signal_type='hiring', confidence=0.5, observed_at='2024-06-15')],
            ),
        ]
        rows = reconcile_claims(claims_by_source)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].observed_at, '2024-06-15')


class AssembleEvidenceRowsTest(unittest.TestCase):
    def test_spec2_claim_from_unresolvable_source_is_dropped(self):
        claims_by_source = [
            ('source-a', [_claim('Acme hired a VP of Sales', signal_type='hiring')]),
            ('source-unresolvable', [_claim('Acme raised a Series B', signal_type='funding')]),
        ]
        rows = assemble_evidence_rows(claims_by_source, resolvable_source_ids={'source-a'})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].source_id, 'source-a')
        for row in rows:
            self.assertTrue(row.source_id)
            self.assertNotEqual(row.source_id, 'source-unresolvable')

    def test_all_sources_resolvable_keeps_every_claim(self):
        claims_by_source = [
            ('source-a', [_claim('Acme hired a VP of Sales', signal_type='hiring')]),
            ('source-b', [_claim('Acme raised a Series B', signal_type='funding')]),
        ]
        rows = assemble_evidence_rows(claims_by_source, resolvable_source_ids={'source-a', 'source-b'})
        self.assertEqual(len(rows), 2)


class PreferObservedAtTest(unittest.TestCase):
    def test_keeps_existing_when_set(self):
        self.assertEqual(_prefer_observed_at('2024-01-01', '2024-06-15'), '2024-01-01')

    def test_uses_incoming_when_existing_is_none(self):
        self.assertEqual(_prefer_observed_at(None, '2024-06-15'), '2024-06-15')


class EvidenceRowTest(unittest.TestCase):
    def test_evidence_row_is_frozen(self):
        row = EvidenceRow(
            source_id='source-a',
            claim='Acme hired a VP of Sales',
            signal_type='hiring',
            confidence=0.6,
            observed_at=None,
        )
        with self.assertRaises(Exception):
            row.confidence = 0.9


if __name__ == '__main__':
    unittest.main()
