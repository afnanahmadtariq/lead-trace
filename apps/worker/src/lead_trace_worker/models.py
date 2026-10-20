from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

SIGNAL_TYPES = (
    'hiring',
    'funding',
    'launch',
    'leadership',
    'partnership',
    'role-context',
    'other',
)

SignalType = Literal[
    'hiring',
    'funding',
    'launch',
    'leadership',
    'partnership',
    'role-context',
    'other',
]


class ExtractedClaim(BaseModel):
    claim: str = Field(min_length=20, max_length=500)
    signal_type: SignalType
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator('claim')
    @classmethod
    def strip_claim(cls, value: str) -> str:
        cleaned = ' '.join(value.split())
        if len(cleaned) < 20:
            raise ValueError('claim too short')
        return cleaned


class SourceBundle(BaseModel):
    source_id: str
    url: str
    title: str
    text: str
    score: float = 0.0


class EvidenceDraft(BaseModel):
    source_id: str
    claim: str
    signal_type: SignalType
    confidence: float = Field(ge=0.0, le=1.0)


class BriefCitation(BaseModel):
    evidence_id: str
    claim: str
    source_url: str
    signal_type: SignalType


class ConversationAngle(BaseModel):
    evidence_id: str = Field(min_length=1)
    why_it_matters: str = Field(min_length=10, max_length=400)
    question: str = Field(min_length=10, max_length=300)

    @field_validator('evidence_id', 'why_it_matters', 'question')
    @classmethod
    def normalize_text(cls, value: str) -> str:
        cleaned = ' '.join(value.split())
        if not cleaned:
            raise ValueError('conversation angle fields cannot be blank')
        return cleaned


class BriefSections(BaseModel):
    summary: str
    key_signals: list[BriefCitation]
    talking_points: list[str]
    conversation_angles: list[ConversationAngle] = Field(default_factory=list, max_length=3)
    questions_to_ask: list[str] = Field(default_factory=list)
    personalized_opener: Optional[str] = None
    objection_handling: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    outreach_draft: Optional[str] = None
    gaps: list[str] = Field(default_factory=list)
    urgency_score: float = Field(default=0.0, ge=0.0, le=1.0)
    urgency_label: Literal['High urgency', 'Moderate', 'Low'] = 'Low'


class RunContext(BaseModel):
    run_id: str
    organization_id: str
    goal: Literal['outreach', 'meeting']
    created_by_id: Optional[str]
    prospect_name: str
    company_name: Optional[str]
    offer_name: str
    value_proposition: str
    sender_name: Optional[str] = None
