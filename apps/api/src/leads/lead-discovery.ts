import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import type { TavilyDiscoveryQuery } from '../tavily/tavily-search.service'
import type { CreateLeadSearchDto } from './leads.dto'

export type LeadSourceInput = { id: string; url: string; title: string; excerpt: string; publisher: string; queries: string[]; publishedAt?: Date | string | null }
export type CriterionEvidence = { sourceId: string; quote: string }
export type LeadQualification = { version: 2; checkedAt: string; sourcePublishedAt: string | null; issues: string[]; evidence: Record<string, CriterionEvidence> }
export type ExtractedLead = { sourceId: string; identityKey: string; name: string; companyName: string; jobTitle: string | null; quote: string; matchedCriteria: string[]; missingCriteria: string[]; qualification: LeadQualification }
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
const contains = (text: string, value: string) => (` ${normalizeIdentity(text)} `).includes(` ${normalizeIdentity(value)} `)
const exactQuote = (source: LeadSourceInput, quote: string) => quote.length >= 10 && source.excerpt.replace(/\s+/g, ' ').includes(quote.replace(/\s+/g, ' '))
function expanded(value: string) {
  return normalizeIdentity(value).replace(/\bceo\b/g, 'chief executive officer').replace(/\bco founder\b/g, 'founder').replace(/\bcofounder\b/g, 'founder').replace(/\bsaas\b/g, 'software as a service').replace(/\buae\b/g, 'united arab emirates')
}
function matches(text: string, requested: string) {
  const tokens = expanded(requested).split(' ').filter((part) => part.length > 1 && !['of', 'and', 'the', 'as', 'a'].includes(part))
  return tokens.length > 0 && tokens.every((part) => (` ${expanded(text)} `).includes(` ${part} `))
}
function geographicMatch(quote: string, requested: string, name: string) {
  // A surname is never location evidence. Keep location proof separate from identity proof.
  const geography = normalizeIdentity(quote).replaceAll(normalizeIdentity(name), ' ')
  if (/\b(?:serving|customers? in|clients? in|markets? in)\b/.test(geography) && !/\b(?:based|headquartered|headquarters|location|office|located)\b/.test(geography)) return false
  if (matches(geography, requested)) return true
  return expanded(requested) === 'united arab emirates' && /\b(?:dubai|abu dhabi|sharjah|ajman|fujairah|ras al khaimah|umm al quwain)\b/.test(geography)
}
function historicalRole(source: LeadSourceInput, quote: string, company: string, title: string) {
  if (/\b(?:former(?:ly)?|ex[- ](?:ceo|founder|head|director)|previously|until\s+20\d{2})\b/i.test(quote)) return true
  // LinkedIn headlines can lag behind the structured current position and work history.
  const current = source.excerpt.match(/(?:^|\n)Current role:\s*([^\n]+)/i)?.[1]
  if (current && title && !matches(current, title) && !matches(title, current)) return true
  const roles = source.excerpt.split('\n').filter((line) => contains(line, company) && title && matches(line, title))
  const ended = (line: string) => /(?:\bto\b|[–—]|\s-\s)\s*(?:[A-Za-z]+\s+)?20\d{2}\s*\)/i.test(line)
  if (roles.some((line) => /\b(?:present|current)\b/i.test(line))) return false
  return ended(quote) || roles.some(ended)
}

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
    if (!source || normalizeIdentity(name).length < 2 || normalizeIdentity(companyName).length < 2 || !/[\p{L}]/u.test(name) || !/[\p{L}]/u.test(companyName) || /\b\p{L}\./u.test(name) || quoteText.length < 20 || !exactQuote(source, quote) || !normalizeIdentity(`${source.title} ${source.excerpt}`).includes(normalizeIdentity(name)) || !evidence.includes(normalizeIdentity(companyName)) || (jobTitle && !quoteText.includes(normalizeIdentity(jobTitle))) || historicalRole(source, quote, companyName, jobTitle)) { rejected++; continue }
    const matchedCriteria: string[] = [], missingCriteria: string[] = []
    const proofs: Record<string, CriterionEvidence> = {}
    const supplied = candidate.evidence && typeof candidate.evidence === 'object' ? candidate.evidence as Record<string, unknown> : {}
    for (const [key, value] of Object.entries(criteria)) {
      if (!value) continue
      const proof = supplied[key] as { sourceId?: unknown; quote?: unknown } | undefined
      const proofSource = proof && sources.find((entry) => entry.id === proof.sourceId)
      const proofQuote = boundedText(proof?.quote, 1200)
      // Cross-page company evidence must identify the company or come from the same
      // company website. A shared platform such as LinkedIn is not a company website.
      const host = (entry: LeadSourceInput) => new URL(entry.url).hostname.replace(/^www\./, '')
      const companyPage = proofSource && (contains(`${proofSource.title} ${proofSource.excerpt}`, companyName) || (host(source) === host(proofSource) && !/(?:linkedin|facebook|instagram)\.com$/.test(host(source))))
      const usable = proofSource && companyPage && exactQuote(proofSource, proofQuote)
      const fits = (text: string) => key === 'location' ? geographicMatch(text, value, name) : matches(text, value)
      const useProvided = usable && fits(proofQuote)
      const proofText = useProvided ? proofQuote : quote
      const matched = key === 'role' ? Boolean(jobTitle && matches(jobTitle, value)) : key === 'location' ? geographicMatch(proofText, value, name) : matches(proofText, value)
      ;(matched ? matchedCriteria : missingCriteria).push(key)
      if (matched) proofs[key] = { sourceId: key === 'role' || !useProvided ? source.id : proofSource.id, quote: key === 'role' || !useProvided ? quote : proofText }
    }
    const issues: string[] = []
    // Old dated articles may be useful research, but cannot establish a current buyer.
    const published = source.publishedAt ? new Date(source.publishedAt) : null
    const validPublished = published && Number.isFinite(published.getTime()) ? published : null
    const publishedYear = validPublished?.getUTCFullYear() ?? Number(source.url.match(/\b(20\d{2})\b/)?.[1] || 0)
    if (publishedYear && publishedYear < new Date().getUTCFullYear()) issues.push('Role needs a current source')
    if (!issues.length && /(?:conference|speakers?|power-list|top-?10|awards?|interviews?)/i.test(source.url)) issues.push('Role needs a current company or professional profile source')
    if (!jobTitle) issues.push('Job title is unconfirmed')
    const identityKey = leadIdentity(name, companyName)
    const record = { sourceId: source.id, identityKey, name, companyName, jobTitle: jobTitle || null, quote, matchedCriteria, missingCriteria, qualification: { version: 2 as const, checkedAt: new Date().toISOString(), sourcePublishedAt: validPublished?.toISOString() || null, issues, evidence: proofs } }
    const previous = accepted.get(identityKey)
    if (!previous || previous.matchedCriteria.length < matchedCriteria.length || (previous.matchedCriteria.length === matchedCriteria.length && previous.qualification.issues.length > issues.length)) accepted.set(identityKey, record)
  }
  return { candidates: [...accepted.values()].sort((a, b) => b.matchedCriteria.length - a.matchedCriteria.length).slice(0, 20), rejected }
}
