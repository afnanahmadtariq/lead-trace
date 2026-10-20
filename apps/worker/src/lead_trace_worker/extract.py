from __future__ import annotations

import re
from decimal import Decimal
from typing import Iterable, Mapping, Optional

from lead_trace_worker.models import ExtractedClaim, RunContext, SignalType

SENTENCE_SPLIT = re.compile(r'(?<=[.!?])\s+')
JUNK = re.compile(
    r'1[- ]?800|call us|copyright|©|all rights reserved|privacy policy|terms of use|cookie|'
    r'liked by|view post|view profile|activity image|report this|sign in|agree\s*(?:&|and)\s*join|'
    r'join now|see all profiles|people also viewed|image \d+ of \d+|uploaded by|ai-enhanced description|'
    r'\bconnections?\b|\bfollowers?\b|\bn\/a\b',
    re.I,
)
TRUNCATED = re.compile(
    r'(?:\.{3}|…)|(?:\b(?:and|or|a|an|the|to|for|with|of|at|in|as|by)\s*[.!?]?$)',
    re.I,
)
FRUIT_CONTEXT = re.compile(
    r'\b(apples\b|fruit|apple tree|orchard|edible fruit|genus|cultivar|mytholog)',
    re.I,
)
BUSINESS_CONTEXT = re.compile(
    r'\b(ceo|chief executive|president|company|corporation|inc\.|technology|software|revenue|founded|headquarters|operations|executive)\b',
    re.I,
)
KEYWORDS: dict[SignalType, tuple[str, ...]] = {
    'hiring': (' hiring ', ' job opening', ' careers', ' is hiring', ' open role', ' joined the team'),
    'funding': (' raised ', ' funding round', ' series a', ' series b', ' series c', ' investment', ' venture'),
    'launch': (' launched ', ' release', ' unveiled ', ' announced a new', ' introduced '),
    'leadership': (
        ' appointed ',
        ' named ceo',
        ' named cto',
        ' chief executive',
        ' joins as',
        ' promoted to',
        ' served as the',
        ' serves as',
    ),
    'partnership': (' partnership ', ' partnered with', ' collaboration with', ' strategic alliance'),
    'role-context': (' focuses on', ' responsible for', ' leads ', ' oversees ', ' based in'),
}
COMPANY_SUFFIXES = {'inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'company', 'group', 'technologies', 'solutions'}
OFFER_STOP_WORDS = {'with', 'that', 'this', 'your', 'their', 'from', 'have', 'help', 'helps', 'improve', 'improves', 'platform', 'solution', 'software', 'using', 'through', 'better', 'more', 'reduce', 'reduces', 'teams', 'company'}

SIGNAL_WEIGHT = {
    'leadership': 0.25,
    'hiring': 0.2,
    'funding': 0.2,
    'launch': 0.15,
    'partnership': 0.12,
    'role-context': 0.1,
    'other': 0.0,
}


def _normalize(text: str) -> str:
    return f' {text.lower()} '


def classify_sentence(sentence: str) -> SignalType:
    lowered = _normalize(sentence)
    for signal_type, words in KEYWORDS.items():
        if any(word in lowered for word in words):
            return signal_type
    return 'other'


def prospect_tokens(prospect_name: str) -> set[str]:
    parts = [part.strip().lower() for part in re.split(r'\s+', prospect_name) if part.strip()]
    tokens = {part for part in parts if len(part) >= 3}
    if parts:
        tokens.add(parts[-1])
    return tokens


def company_tokens(company_name: Optional[str]) -> set[str]:
    if not company_name:
        return set()
    parts = re.findall(r'[\w]+', company_name.casefold())
    distinctive = [part for part in parts if part not in COMPANY_SUFFIXES]
    # Match the company name as a phrase, never an arbitrary component of a
    # multi-word brand or a legal suffix shared by unrelated businesses.
    name = ' '.join(distinctive) or ' '.join(parts)
    return {name} if name else set()


def _contains_identity(text: str, identity: str) -> bool:
    normalized = ' '.join(re.findall(r'[\w]+', text.casefold()))
    identity = ' '.join(re.findall(r'[\w]+', identity.casefold()))
    return bool(identity and re.search(r'(?<!\w)' + re.escape(identity) + r'(?!\w)', normalized))


def is_junk_claim(sentence: str) -> bool:
    cleaned = ' '.join(sentence.split()).strip()
    if len(cleaned) < 20 or len(cleaned) > 500:
        return True
    if JUNK.search(cleaned) or TRUNCATED.search(cleaned):
        return True
    if '#' in cleaned:
        return True
    return len(re.findall(r'[A-Za-z]{2,}', cleaned)) < 4


def is_relevant_claim(sentence: str, *, prospect_name: str, company_name: Optional[str]) -> bool:
    if is_junk_claim(sentence):
        return False
    lowered = sentence.lower()
    if FRUIT_CONTEXT.search(sentence) and not BUSINESS_CONTEXT.search(sentence):
        return False
    if re.search(r'\bapples\b', lowered) and 'apple inc' not in lowered:
        return False
    person = ' '.join(prospect_name.lower().split())
    companies = company_tokens(company_name)

    if _contains_identity(sentence, person):
        return True
    if any(_contains_identity(sentence, token) for token in companies):
        return True
    return False


def score_sentence(
    sentence: str,
    *,
    prospect_name: str,
    company_name: Optional[str],
    source_score: float,
    signal_type: SignalType,
) -> float:
    lowered = sentence.lower()
    people = prospect_tokens(prospect_name)
    companies = company_tokens(company_name)
    confidence = 0.35
    if any(_contains_identity(sentence, token) for token in people):
        confidence += 0.28
    if any(_contains_identity(sentence, token) for token in companies):
        confidence += 0.18
    confidence += SIGNAL_WEIGHT.get(signal_type, 0.0)
    confidence += min(max(source_score, 0.0), 1.0) * 0.12
    if 70 <= len(sentence) <= 240:
        confidence += 0.05
    if FRUIT_CONTEXT.search(sentence) and not BUSINESS_CONTEXT.search(sentence):
        confidence -= 0.35
    return round(max(0.0, min(confidence, 0.98)), 2)


def split_sentences(text: str) -> list[str]:
    cleaned = ' '.join(text.split())
    if not cleaned:
        return []
    parts = SENTENCE_SPLIT.split(cleaned)
    return [part.strip() for part in parts if 35 <= len(part.strip()) <= 420]


def extract_claims(
    text: str,
    *,
    prospect_name: str,
    company_name: Optional[str] = None,
    source_score: float = 0.0,
    limit: int = 3,
) -> list[ExtractedClaim]:
    seen: set[str] = set()
    ranked: list[ExtractedClaim] = []

    for sentence in split_sentences(text):
        if not is_relevant_claim(sentence, prospect_name=prospect_name, company_name=company_name):
            continue
        signal_type = classify_sentence(sentence)
        key = sentence.lower()[:120]
        if key in seen:
            continue
        seen.add(key)
        confidence = score_sentence(
            sentence,
            prospect_name=prospect_name,
            company_name=company_name,
            source_score=source_score,
            signal_type=signal_type,
        )
        if confidence < 0.55:
            continue
        try:
            ranked.append(
                ExtractedClaim(
                    claim=sentence,
                    signal_type=signal_type,
                    confidence=confidence,
                )
            )
        except ValueError:
            continue

    ranked.sort(key=lambda item: item.confidence, reverse=True)
    return ranked[:limit]


def merge_claim_lists(groups: Iterable[list[ExtractedClaim]], *, limit: int = 12) -> list[ExtractedClaim]:
    merged: list[ExtractedClaim] = []
    seen: set[str] = set()
    for group in groups:
        for claim in group:
            key = claim.claim.lower()[:120]
            if key in seen:
                continue
            seen.add(key)
            merged.append(claim)
    merged.sort(key=lambda item: item.confidence, reverse=True)
    return merged[:limit]


_NUMBER_AMOUNT = re.compile(
    r'(?<![\w])\$?(-?\d[\d,]*(?:\.\d+)?)\s*(?:(thousand|million|billion|trillion|[kmbt])\b)?\s*(%|percent\b)?',
    re.I,
)
_AMOUNT_SCALE = {'k': 1000, 'thousand': 1000, 'm': 1000000, 'million': 1000000,
                 'b': 1000000000, 'billion': 1000000000, 't': 1000000000000, 'trillion': 1000000000000}


def numeric_quantities(text: str) -> set[tuple[Decimal, bool]]:
    """Compare written numeric amounts such as $300M and 300 million equally."""
    return {
        (Decimal(number.replace(',', '')) * _AMOUNT_SCALE.get((scale or '').lower(), 1), bool(percent))
        for number, scale, percent in _NUMBER_AMOUNT.findall(text)
    }


def _near_duplicate_claim(first: str, second: str) -> bool:
    # Do not collapse contradictory amounts or different dated events.
    if numeric_quantities(first) != numeric_quantities(second):
        return False
    ignored = {'the', 'and', 'for', 'with', 'that', 'this', 'will', 'has', 'have', 'expects', 'expected', 'expect',
               'plans', 'planned', 'announced', 'announces', 'would', 'its', 'close', 'closes', 'closed', 'closing',
               'approximately', 'about', 'certain', 'set'}
    def terms(text: str) -> set[str]:
        # Amount equivalence was already checked above. Remove the entire
        # amount so '$300M' and '$300 million' have the same lexical footprint.
        text = _NUMBER_AMOUNT.sub(' ', text)
        return {word for word in re.findall(r'[a-z]+', text.lower()) if len(word) > 2 and word not in ignored}
    a, b = terms(first), terms(second)
    return bool(a and b and len(a & b) / len(a | b) >= 0.70)


def _identity_anchor(row: Mapping[str, object]) -> bool:
    claim = str(row.get('claim', ''))
    if re.search(r'\b(appointed|named|promoted|succeeded|succeeds|joins|joined|became)\b', claim, re.I):
        return False
    return row.get('signal_type') == 'leadership' or (
        row.get('signal_type') == 'role-context' and
        bool(re.search(r'\b(ceo|cto|chief executive|chief technology|founder)\b|\b(?:is|operates as)\s+(?:a|an|the)\s+', claim, re.I))
    )


def rank_evidence_for_brief(
    evidence: list[Mapping[str, object]],
    context: RunContext,
    *,
    limit: int = 5,
) -> list[dict]:
    ranked: list[tuple[float, dict]] = []
    seen: set[str] = set()
    offer_terms = {term for term in re.findall(r'[a-z]{4,}', f'{context.offer_name} {context.value_proposition}'.lower()) if term not in OFFER_STOP_WORDS}
    for row in evidence:
        claim = str(row.get('claim', ''))
        if not claim or is_junk_claim(claim):
            continue
        if not is_relevant_claim(claim, prospect_name=context.prospect_name, company_name=context.company_name):
            continue
        signal_type = str(row.get('signal_type', 'other'))
        confidence = float(row.get('confidence', 0.0))
        overlap = offer_terms & set(re.findall(r'[a-z]{4,}', claim.lower()))
        # A supported product/workflow fact may be more useful than a generic
        # executive biography even when it is classified as 'other'.
        other_threshold = 0.65 if len(overlap) >= 2 else 0.80
        if confidence < 0.55 or (signal_type == 'other' and confidence < other_threshold):
            continue
        key = ' '.join(claim.casefold().split()).rstrip('.!?')
        if key in seen:
            continue
        seen.add(key)
        # Offer overlap guides selection; it is relevance, not evidence of need.
        overlap = offer_terms & set(re.findall(r'[a-z]{4,}', claim.lower()))
        score = confidence + SIGNAL_WEIGHT.get(signal_type, 0.0) + min(len(overlap) * 0.15, 0.45)
        if overlap and not _identity_anchor(row):
            score += 1.0
        ranked.append((score, dict(row)))
    ranked.sort(key=lambda item: item[0], reverse=True)
    selected: list[dict] = []
    has_identity_anchor = False
    for _, row in ranked:
        anchor = _identity_anchor(row)
        if anchor and has_identity_anchor:
            continue
        if any(_near_duplicate_claim(str(row['claim']), str(previous['claim'])) for previous in selected):
            continue
        selected.append(row)
        has_identity_anchor = has_identity_anchor or anchor
        if len(selected) >= limit:
            break
    return selected
