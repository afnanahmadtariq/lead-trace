import type { ResearchEvidenceItem } from './research'

export interface BriefCitation {
  evidence_id: string
  claim: string
  source_url: string
  signal_type: string
}

export interface ConversationAngle {
  evidence_id: string
  why_it_matters: string
  question: string
}

export interface BriefSections {
  conversation_angles?: ConversationAngle[]
  summary?: string
  key_signals?: BriefCitation[]
  talking_points?: string[]
  questions_to_ask?: string[]
  personalized_opener?: string
  objection_handling?: string[]
  next_steps?: string[]
  outreach_draft?: string
  gaps?: string[]
  urgency_score?: number
  urgency_label?: 'High urgency' | 'Moderate' | 'Low'
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

export function publicSourceUrl(value: unknown): value is string {
  if (!nonEmptyText(value)) return false
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

export function parseBriefSections(sections: unknown): BriefSections | null {
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return null
  const raw = sections as Record<string, unknown>
  const parsed: BriefSections = {}
  for (const key of ['summary', 'personalized_opener', 'outreach_draft'] as const) {
    if (nonEmptyText(raw[key])) parsed[key] = raw[key].trim()
  }
  for (const key of ['talking_points', 'questions_to_ask', 'objection_handling', 'next_steps', 'gaps'] as const) {
    if (Array.isArray(raw[key])) parsed[key] = raw[key].filter(nonEmptyText)
  }
  const seen = new Set<string>()
  parsed.key_signals = Array.isArray(raw.key_signals) ? raw.key_signals.filter((item): item is BriefCitation => {
    if (!item || typeof item !== 'object') return false
    if (!nonEmptyText(item.evidence_id) || !nonEmptyText(item.claim) || !nonEmptyText(item.signal_type) || !publicSourceUrl(item.source_url) || seen.has(item.evidence_id)) return false
    seen.add(item.evidence_id)
    return true
  }) : []
  const citedIds = new Set(parsed.key_signals.map((item) => item.evidence_id))
  const angleIds = new Set<string>()
  parsed.conversation_angles = Array.isArray(raw.conversation_angles) ? raw.conversation_angles.filter((item): item is ConversationAngle => {
    if (!item || !nonEmptyText(item.evidence_id) || !nonEmptyText(item.why_it_matters) || !nonEmptyText(item.question) || !citedIds.has(item.evidence_id) || angleIds.has(item.evidence_id)) return false
    angleIds.add(item.evidence_id)
    return true
  }).slice(0, 3) : []
  if (typeof raw.urgency_score === 'number' && Number.isFinite(raw.urgency_score)) parsed.urgency_score = raw.urgency_score
  if (raw.urgency_label === 'High urgency' || raw.urgency_label === 'Moderate' || raw.urgency_label === 'Low') parsed.urgency_label = raw.urgency_label
  return parsed
}

/** Count only the citations included in the brief, not every claim collected by research. */
export function briefCitations(sections: unknown, evidence?: ResearchEvidenceItem[]): BriefCitation[] {
  const citations = parseBriefSections(sections)?.key_signals ?? []
  if (evidence === undefined) return citations
  return citations.filter((citation) => evidence.some((item) => item.id === citation.evidence_id && item.claim === citation.claim && item.source.url === citation.source_url))
}

export function briefUrgencyLabel(sections: unknown): BriefSections['urgency_label'] | undefined {
  return parseBriefSections(sections)?.urgency_label
}
