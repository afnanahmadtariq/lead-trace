import { expect, test } from '@playwright/test'
import { briefCitations, parseBriefSections } from '../lib/brief'
import { extractBriefDiff, formatConversationPack } from '../lib/conversation-pack'

const citation = { evidence_id: 'cited', claim: 'Northstar opened a new office.', source_url: 'https://example.com/news', signal_type: 'expansion' }
const evidence = [
  { id: 'cited', claim: citation.claim, signalType: 'expansion', confidence: 0.8, source: { title: 'News', url: citation.source_url } },
  { id: 'unused', claim: 'An unrelated historical claim.', signalType: 'other', confidence: 0.9, source: { title: 'History', url: 'https://example.com/history' } },
]

test('citations exclude collected but uncited claims and mismatched stored evidence', () => {
  const sections = { key_signals: [citation, citation, { ...citation, evidence_id: 'missing' }, { ...citation, evidence_id: 'unused', claim: 'Invented claim' }] }
  expect(briefCitations(sections, evidence)).toEqual([citation])
  expect(briefCitations(sections, [])).toEqual([])
  expect(briefCitations({ key_signals: [{ ...citation, source_url: 'https://different.example/' }] }, evidence)).toEqual([])
})

test('malformed model output cannot crash citation rendering or create unsafe links', () => {
  expect(parseBriefSections([])).toBeNull()
  expect(briefCitations({ key_signals: 'not-an-array' })).toEqual([])
  expect(briefCitations({ key_signals: [null, {}, { ...citation, source_url: 'javascript:alert(1)' }, citation] })).toEqual([citation])
})

test('outreach exports preserve the message, objections, gaps and source references', () => {
  const pack = formatConversationPack({ summary: 'Summary', outreach_draft: 'Hello, would a short conversation help?', objection_handling: ['Ask about timing.'], gaps: ['Budget is not established.'], key_signals: [citation] }, 'outreach')
  for (const value of ['OUTREACH MESSAGE', 'Hello, would a short conversation help?', 'OBJECTION HANDLING', 'VERIFY BEFORE USE', 'Budget is not established.', citation.source_url]) expect(pack).toContain(value)
})

test('refresh differences include changed outreach and new research gaps', () => {
  expect(extractBriefDiff({ outreach_draft: 'Old message', gaps: [] }, { outreach_draft: 'New message', gaps: ['Unknown budget'] }).map((item) => item.field)).toEqual(['Outreach message', 'Research gaps'])
})


test('angles reference selected signals and exports preserve the fact and hypothesis', () => {
  const angle = { evidence_id: 'cited', why_it_matters: 'If the new office expands your team, onboarding may matter.', question: 'How are you onboarding the new team?' }
  const sections = parseBriefSections({ key_signals: [citation], conversation_angles: [angle, { ...angle, evidence_id: 'missing' }, null] })
  expect(sections?.conversation_angles).toEqual([angle])
  const pack = formatConversationPack(sections!, 'meeting')
  for (const value of [citation.claim, angle.why_it_matters, angle.question]) expect(pack).toContain(value)
})

test('landing walkthrough remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Follow the angle' }).click()
  await expect(page.getByRole('button', { name: /Possible fit/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('An angle worth exploring', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})
