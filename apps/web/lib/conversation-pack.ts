import { parseBriefSections, type BriefSections } from './brief'

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function formatConversationPack(sections: unknown, goal: 'meeting' | 'outreach') {
  const brief = parseBriefSections(sections)
  if (!brief) return ''

  const lines: string[] = []
  const citations = brief.key_signals ?? []
  const footnotes = new Map<string, number>()
  citations.forEach((citation, index) => footnotes.set(citation.evidence_id, index + 1))

  const summary = text(brief.summary)
  if (summary) lines.push('SUMMARY', summary, '')

  const opener = text(brief.personalized_opener)
  if (opener) lines.push('OPENER', opener, '')

  const angles = brief.conversation_angles ?? []
  if (angles.length) {
    lines.push('CONVERSATION ANGLES')
    for (const angle of angles) {
      const citation = citations.find((item) => item.evidence_id === angle.evidence_id)
      if (citation) lines.push(`Source claim [${footnotes.get(citation.evidence_id)}]: ${citation.claim}`, `Hypothesis to validate: ${angle.why_it_matters}`, `Ask: ${angle.question}`, '')
    }
  }

  const talkingPoints = list(brief.talking_points)
  if (talkingPoints.length) {
    lines.push('TALKING POINTS')
    talkingPoints.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
    lines.push('')
  }

  if (goal === 'meeting') {
    const questions = list(brief.questions_to_ask)
    if (questions.length) {
      lines.push('QUESTIONS TO ASK')
      questions.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
      lines.push('')
    }
  }

  const objections = list(brief.objection_handling)
  if (objections.length) lines.push('OBJECTION HANDLING', ...objections.map((item, index) => `${index + 1}. ${item}`), '')

  const outreach = text(brief.outreach_draft)
  if (goal === 'outreach' && outreach) lines.push('OUTREACH MESSAGE', outreach, '')

  const gaps = list(brief.gaps)
  if (gaps.length) lines.push('VERIFY BEFORE USE', ...gaps.map((item) => `- ${item}`), '')

  const nextSteps = list(brief.next_steps)
  if (nextSteps.length) {
    lines.push('NEXT STEPS')
    nextSteps.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
    lines.push('')
  }

  if (citations.length) {
    lines.push('CITATIONS')
    citations.forEach((citation) => {
      const number = footnotes.get(citation.evidence_id)
      lines.push(`[${number}] ${citation.claim} (${citation.signal_type}) — ${citation.source_url}`)
    })
  }

  return lines.join('\n').trim()
}

export function extractBriefDiff(previous: unknown, current: unknown): Array<{ field: string; before: string; after: string }> {
  const prev = parseBriefSections(previous)
  const next = parseBriefSections(current)
  if (!prev || !next) return []

  const fields: Array<{ field: string; key: keyof BriefSections }> = [
    { field: 'Summary', key: 'summary' },
    { field: 'Opener', key: 'personalized_opener' },
    { field: 'Talking points', key: 'talking_points' },
    { field: 'Questions', key: 'questions_to_ask' },
    { field: 'Objections', key: 'objection_handling' },
    { field: 'Next steps', key: 'next_steps' },
    { field: 'Outreach message', key: 'outreach_draft' },
    { field: 'Research gaps', key: 'gaps' },
    { field: 'Conversation angles', key: 'conversation_angles' },
  ]

  return fields.flatMap(({ field, key }) => {
    const angleText = (value: unknown) => Array.isArray(value) ? value.map((angle) => `${angle.why_it_matters} ${angle.question}`).join('\n') : ''
    const before = key === 'conversation_angles' ? angleText(prev[key]) : Array.isArray(prev[key]) ? list(prev[key]).join('\n') : text(prev[key]) || ''
    const after = key === 'conversation_angles' ? angleText(next[key]) : Array.isArray(next[key]) ? list(next[key]).join('\n') : text(next[key]) || ''
    if (before === after) return []
    return [{ field, before, after }]
  })
}
