import { explicitSaasExample, normalizeIdentity, validateExtractedLeads, type ExtractedLead, type LeadSourceInput } from './lead-discovery'
import { sameRegisteredCompany } from './lead-registries.service'
import type { CompanyTarget, LeadCriteria } from './lead-types'

// Qualification batches can miss a company page held by another batch. Recheck
// missing criteria against exact passages from that company's sourced website.
export function corroborateCompanyEvidence(candidates: ExtractedLead[], sources: LeadSourceInput[], companies: CompanyTarget[], criteria: LeadCriteria): ExtractedLead[] {
  return candidates.map((candidate) => {
    const company = companies.find((company) => company.domain && sameRegisteredCompany(company.name, candidate.companyName))
    if (!company?.domain || !candidate.missingCriteria.length) return candidate
    const official = sources.filter((source) => {
      const url = new URL(source.url)
      return source.sourceKind !== 'registry' && url.hostname.replace(/^www\./, '') === company.domain
        && !/\/(?:glossary|author|customers?|case-studies)(?:\/|$)/i.test(url.pathname)
    })
    let result = candidate
    for (const key of candidate.missingCriteria.filter((key) => key !== 'role')) {
      const proposals = official.flatMap((source) => {
        const quotes = source.excerpt.split(/\n\s*\n|(?<=[.!?])\s+/)
        // A product description and its business audience can span paragraphs.
        // Windows retain the exact contiguous source text, including line breaks.
        for (let offset = 0; offset < source.excerpt.length; offset += 400) quotes.push(source.excerpt.slice(offset, offset + 1200))
        return quotes.map((quote) => ({ source, quote: quote.trim() }))
      })
      for (const { source, quote } of proposals) {
        if (quote.length < 20 || quote.length > 1200) continue
        if (/\/(?:blog|blog-posts)(?:\/|$)/i.test(new URL(source.url).pathname) && !explicitSaasExample(quote, company.name)) continue
        const identifiesCompany = normalizeIdentity(quote).includes(normalizeIdentity(company.name)) || /\b(?:we (?:are|provide|offer|build)|our (?:software|platform|products?))\b/i.test(quote)
        if (!identifiesCompany) continue
        const proposed = { ...result, evidence: { ...result.qualification.evidence, [key]: { sourceId: source.id, quote } } }
        const checked = validateExtractedLeads({ candidates: [proposed] }, sources, criteria).candidates[0]
        if (checked && !checked.missingCriteria.includes(key)) { result = checked; break }
      }
    }
    return result
  })
}
