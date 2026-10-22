import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import type { TavilyDiscoveryQuery } from '../tavily/tavily-search.service'
import type { CreateLeadSearchDto } from './leads.dto'

export type LeadSourceInput = { id: string; url: string; title: string; excerpt: string; publisher: string; queries: string[] }
export type ExtractedLead = { sourceId: string; identityKey: string; name: string; companyName: string; jobTitle: string | null; quote: string; matchedCriteria: string[]; missingCriteria: string[] }
export function normalizeIdentity(value: string) { return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() }
export function leadIdentity(name: string, company: string) { return createHash('sha256').update(JSON.stringify([normalizeIdentity(name), normalizeIdentity(company)])).digest('hex') }
const term = (value?: string | null) => value?.replace(/["\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || ''
export function buildLeadQueries(input: Pick<CreateLeadSearchDto, 'industry' | 'role' | 'location' | 'keywords'>): TavilyDiscoveryQuery[] {
  const core = [input.role, input.industry, input.location].map((value) => term(value)).filter(Boolean).map((value) => `"${value}"`).join(' ')
  const keywords = term(input.keywords)
  return [
    { kind: 'people', query: `${core} ${keywords} leadership team`.trim().slice(0, 400), topic: 'general' },
    { kind: 'profiles', query: `site:linkedin.com/in ${core} ${keywords}`.trim().slice(0, 400), topic: 'general' },
    { kind: 'company-team', query: `${term(input.industry)} ${term(input.location)} ${keywords} companies ${term(input.role)} team`.trim().slice(0, 400), topic: 'general' },
  ]
}
export function publicSourceUrl(value: string) {
  try {
    const url = new URL(value), host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host) || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null
    if ((host === 'linkedin.com' || host.endsWith('.linkedin.com')) && !/\/(?:in|company)\/[^/]+/.test(url.pathname)) return null
    url.hash = ''; return url.toString()
  } catch { return null }
}
const boundedText = (value: unknown, maximum: number) => typeof value === 'string' && value.trim().length <= maximum ? value.trim() : ''

export function validateExtractedLeads(payload: unknown, sources: LeadSourceInput[], criteria: Pick<CreateLeadSearchDto, 'industry' | 'role' | 'location' | 'keywords'>) {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { candidates?: unknown }).candidates)) throw new Error('Lead extraction returned an invalid JSON schema')
  const proposed = (payload as { candidates: unknown[] }).candidates
  if (proposed.length > 50) throw new Error('Lead extraction exceeded the candidate limit')
  const accepted = new Map<string, ExtractedLead>()
  let rejected = 0
  for (const value of proposed) {
    if (!value || typeof value !== 'object') { rejected++; continue }
    const candidate = value as Record<string, unknown>
    const name = boundedText(candidate.name, 120), companyName = boundedText(candidate.companyName, 160), quote = boundedText(candidate.quote, 1200), jobTitle = boundedText(candidate.jobTitle, 120)
    const source = sources.find((source) => source.id === candidate.sourceId)
    const evidence = source ? normalizeIdentity(`${source.title} ${quote}`) : ''
    const quoteText = normalizeIdentity(quote)
    if (!source || !name || !companyName || quoteText.length < 20 || !source.excerpt.replace(/\s+/g, ' ').includes(quote.replace(/\s+/g, ' ')) || !evidence.includes(normalizeIdentity(name)) || !evidence.includes(normalizeIdentity(companyName)) || (jobTitle && !evidence.includes(normalizeIdentity(jobTitle)))) { rejected++; continue }
    const matchedCriteria: string[] = [], missingCriteria: string[] = []
    for (const [key, value] of Object.entries(criteria)) {
      if (!value) continue
      const requested = normalizeIdentity(value).split(' ').filter((part) => part.length > 1)
      const matched = requested.length > 0 && requested.every((part) => (` ${evidence} `).includes(` ${part} `))
      ;(matched ? matchedCriteria : missingCriteria).push(key)
    }
    const identityKey = leadIdentity(name, companyName)
    const record = { sourceId: source.id, identityKey, name, companyName, jobTitle: jobTitle || null, quote, matchedCriteria, missingCriteria }
    const previous = accepted.get(identityKey)
    if (!previous || previous.matchedCriteria.length < matchedCriteria.length) accepted.set(identityKey, record)
  }
  return { candidates: [...accepted.values()].sort((a, b) => b.matchedCriteria.length - a.matchedCriteria.length).slice(0, 20), rejected }
}
