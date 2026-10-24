import { BadGatewayException, Injectable } from '@nestjs/common'
import { deduplicateDiscoveredSources } from '../research/research-discovery'
import { TavilySearchService, type TavilyDiscoveryQuery, type TavilySearchBatch, type TavilySource } from '../tavily/tavily-search.service'
import { buildLeadQueries, publicSourceUrl, type LeadSourceInput } from './lead-discovery'
import { LeadExtractionService } from './lead-extraction.service'
import { companyDomain, currentRoleCompanies, LeadCompanyPlanner } from './lead-company-planner.service'
import { LeadRegistriesService } from './lead-registries.service'
import type { CompanyTarget, DiscoverySnapshot, LeadCriteria, ProgressCallback, ProviderActivity } from './lead-types'

export function deepLeadQueries(criteria: LeadCriteria): TavilyDiscoveryQuery[] {
  const clean = (value?: string | null) => (value || '').replace(/["\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
  const industry = /saas/i.test(criteria.industry) ? 'SaaS' : clean(criteria.industry)
  const role = clean(criteria.role), location = clean(criteria.location), keywords = clean(criteria.keywords)
  return [
    `"${role}" "${industry}" ${location} ${keywords} current leadership -jobs -hiring`,
    `site:linkedin.com/in "${role}" "${industry}" ${location} ${keywords}`,
    `${industry} ${location} ${keywords} B2B companies official website products`,
    `${industry} ${location} "our team" sales leadership`,
    `${industry} ${location} companies directory customers businesses`,
    /saas|software/i.test(industry) ? `site:ycombinator.com/companies ${industry} ${location} B2B` : `${industry} ${location} company founders leadership directory`,
  ].map((query, index) => ({ kind: index < 2 ? 'people' : 'company-discovery', query: query.trim().slice(0, 400), topic: 'general' }))
}
export function companyPeopleQueries(company: CompanyTarget, criteria: LeadCriteria): TavilyDiscoveryQuery[] {
  const name = company.name.replace(/["\r\n]/g, ' '), role = criteria.role.replace(/["\r\n]/g, ' ')
  const related = criteria.roleMatch === 'function' && /sales|revenue/i.test(role) ? 'sales leadership VP sales chief revenue officer' : role
  return [
    { kind: 'company-people', query: `"${name}" "${role}" current ${criteria.location || ''} -jobs -hiring`.slice(0, 400), topic: 'general' },
    { kind: 'company-team', query: `${company.domain ? `site:${company.domain}` : `"${name}"`} ${related} team leadership about company`.slice(0, 400), topic: 'general' },
    { kind: 'company-overview', query: `"${name}" ${criteria.industry.replace(/["\r\n]/g, ' ')} products business customers cloud software headquarters`.slice(0, 400), topic: 'general' },
  ]
}

@Injectable()
export class LeadDeepDiscoveryService {
  constructor(private readonly tavily: TavilySearchService, private readonly extraction: LeadExtractionService, private readonly registries: LeadRegistriesService, private readonly planner: LeadCompanyPlanner) {}

  async run(criteria: LeadCriteria, depth: string, searchId: string, progress: ProgressCallback) {
    const activity: ProviderActivity[] = [], queries: { kind: string; query: string }[] = [], pool = new Map<string, LeadSourceInput>()
    let failedQueries = 0, companies: CompanyTarget[] = [], nextId = 0
    const add = (source: LeadSourceInput) => {
      const url = publicSourceUrl(source.url)
      if (!url || !source.excerpt) return
      const previous = pool.get(url)
      if (previous) {
        previous.queries = [...new Set([...previous.queries, ...source.queries])]
        if (source.excerpt.length > previous.excerpt.length && !previous.excerpt.includes(source.excerpt)) {
          previous.excerpt = `${previous.excerpt.slice(0, 2500)}\n\nPage text:\n${source.excerpt}`.slice(0, 14000)
          previous.sourceKind = source.sourceKind || previous.sourceKind
        }
        return
      }
      if (pool.size < 240) pool.set(url, { ...source, url, id: source.id || `s${++nextId}`, excerpt: source.excerpt.slice(0, 14000) })
    }
    const update = (phase: string, message: string) => progress({ phase, message, sources: pool.size, companies: companies.length, queries: queries.length })
    const search = async (inputs: TavilyDiscoveryQuery[]) => {
      queries.push(...inputs.map(({ kind, query }) => ({ kind, query })))
      const settled = await Promise.allSettled(inputs.map((query) => this.tavily.search({ ...query, sessionId: searchId })))
      const batches: TavilySearchBatch[] = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      const failures = settled.length - batches.length; failedQueries += failures
      activity.push({ provider: 'Tavily', operation: 'search', requests: inputs.length, records: batches.reduce((sum, batch) => sum + batch.sources.length, 0), credits: batches.every((batch) => batch.credits !== null) ? batches.reduce((sum, batch) => sum + (batch.credits || 0), 0) : null, status: failures ? batches.length ? 'partial' : 'unavailable' : 'ok' })
      for (const source of deduplicateDiscoveredSources(batches)) if (source.score >= 0.3 && source.excerpt) add({ id: '', url: source.url, title: source.title, excerpt: source.excerpt, publisher: source.publisher, publishedAt: source.publishedAt, provider: 'tavily', sourceKind: inputs[0]?.kind === 'company-people' ? 'targeted_search' : 'search', queries: [...new Set(source.matches.map((match) => match.query))] })
      return batches.length
    }
    await update('discovering', depth === 'deep' ? 'Searching for relevant companies and people across web sources and registries.' : 'Searching public professional sources.')
    if (depth !== 'deep') {
      if (!await search(buildLeadQueries(criteria))) throw new BadGatewayException('Web discovery is unavailable. Retry this search.')
      const sources = [...pool.values()].slice(0, 18)
      await update('extracting', 'Checking people, current roles, and buyer-profile evidence.')
      const extracted = sources.length ? await this.extraction.extract(sources, criteria) : { candidates: [], rejected: 0 }
      return { ...extracted, sources, companies, activity, queries, failedQueries }
    }
    const [initialSearches, registrySeed] = await Promise.all([search(deepLeadQueries(criteria)), this.registries.seed(criteria)])
    activity.push(...registrySeed.activity); registrySeed.sources.forEach(add)
    if (!initialSearches) throw new BadGatewayException('Web discovery is unavailable. Registry records alone cannot establish current buyers. Retry this search.')
    if (!pool.size) throw new BadGatewayException('Discovery sources are unavailable. Retry this search.')
    await update('companies', 'Building a company shortlist from sourced names and official websites.')
    companies = currentRoleCompanies([...pool.values()], criteria)
    try {
      const planned = await this.planner.plan([...pool.values()].slice(0, 48), criteria)
      companies = [...new Map([...companies, ...planned].map((company) => [company.name.toLowerCase(), company])).values()].slice(0, 8)
      activity.push({ provider: 'Qwen', operation: 'company planning', requests: 1, records: companies.length, credits: null, status: 'ok' })
    } catch { activity.push({ provider: 'Qwen', operation: 'company planning', requests: 1, records: 0, credits: null, status: 'unavailable', message: 'Company planning unavailable; sourced current employers and direct people discovery continue.' }) }
    await update('people', `Searching current teams at ${companies.length} sourced companies and corroborating registry records.`)
    const targetQueries = companies.flatMap((company) => companyPeopleQueries(company, criteria))
    if (targetQueries.length) await search(targetQueries)
    for (const company of companies) if (!company.domain) {
      for (const source of pool.values()) {
        if (source.sourceKind === 'registry' || /jobs|salary|recruit|headhunt/i.test(source.url)) continue
        const domain = companyDomain(new URL(source.url).hostname, company.name, [...pool.values()])
        if (domain) { company.domain = domain; break }
      }
    }
    await update('reading', 'Reading full pages and following leadership pages on company websites.')
    const pages = [...pool.values()].filter((source) => source.sourceKind !== 'registry' && !source.url.includes('linkedin.com')).sort((a, b) => Number(/team|leadership|management|about|people/i.test(b.url)) - Number(/team|leadership|management|about|people/i.test(a.url))).slice(0, 16)
    const pageUrls = [...new Set([...companies.flatMap((company) => company.domain ? [`https://${company.domain}/`] : []), ...pages.map((page) => page.url)])].slice(0, 16)
    const addRead = (source: TavilySource, sourceKind: string) => { if (source.excerpt) add({ id: '', url: source.url, title: source.title, excerpt: source.excerpt, publisher: source.publisher, provider: 'tavily', sourceKind, queries: [] }) }
    await Promise.all([
      (async () => {
        const results = await Promise.all(companies.map((company) => this.registries.enrich(company, criteria)))
        results.forEach((result, index) => {
          companies[index].registries = result.records; activity.push(...result.activity)
          result.records.forEach((record, recordIndex) => add(this.registries.source(record, `registry-${index}-${recordIndex}`)))
        })
      })(),
      (async () => {
        if (!pageUrls.length) return
        try {
          const response = await this.tavily.extractPages(pageUrls, `${criteria.role} current leadership ${criteria.industry} cloud software business customers company headquarters ${criteria.location || ''}`, searchId)
          response.sources.forEach((source) => addRead(source, 'full_page'))
          activity.push({ provider: 'Tavily', operation: 'full-page extraction', requests: 1, records: response.sources.length, credits: response.credits, status: response.failed ? response.sources.length ? 'partial' : 'unavailable' : 'ok' })
        } catch { activity.push({ provider: 'Tavily', operation: 'full-page extraction', requests: 1, records: 0, credits: null, status: 'unavailable', message: 'Some full pages could not be read; search excerpts remain available.' }) }
      })(),
      ...companies.filter((company) => company.domain).slice(0, 4).map(async (company) => {
        try {
          const response = await this.tavily.crawlCompany(`https://${company.domain}`, criteria.role, searchId)
          response.sources.filter((source) => { try { return new URL(source.url).hostname.replace(/^www\./, '') === company.domain } catch { return false } }).forEach((source) => addRead(source, 'company_crawl'))
          activity.push({ provider: 'Tavily', operation: 'company-site crawl', requests: 1, records: response.sources.length, credits: response.credits, status: 'ok' })
        } catch { activity.push({ provider: 'Tavily', operation: 'company-site crawl', requests: 1, records: 0, credits: null, status: 'unavailable' }) }
      }),
    ])
    const anchors = new Set(companies.map((company) => company.sourceId))
    const ranked = [...pool.values()].sort((a, b) => {
      const rank = (source: LeadSourceInput) => anchors.has(source.id) ? 5 : ['company_crawl', 'full_page'].includes(source.sourceKind || '') ? 4 : source.sourceKind === 'targeted_search' ? 3 : source.sourceKind === 'registry' ? 1 : 2
      return rank(b) - rank(a)
    })
    const registryEvidence = ranked.filter((source) => source.sourceKind === 'registry' && !source.id.startsWith('registry-seed-')).slice(0, 10)
    const sources = [...new Map([...ranked.filter((source) => anchors.has(source.id)), ...registryEvidence, ...ranked].map((source) => [source.id, source])).values()].slice(0, 64)
    await update('extracting', `Qualifying people against the requested profile using ${sources.length} source snapshots.`)
    const companyDomains = new Set(companies.flatMap((company) => company.domain ? [company.domain] : []))
    const facts = sources.filter((source) => companyDomains.has(new URL(source.url).hostname.replace(/^www\./, '')) && ['full_page', 'company_crawl'].includes(source.sourceKind || ''))
    // Shared context is repeated in every group request, so keep it small; a group's own full-length sources override the trimmed copies.
    const groups: LeadSourceInput[][] = [], context = [...new Map([...facts, ...sources.filter((source) => anchors.has(source.id) || source.sourceKind === 'registry')].map((source) => [source.id, source])).values()].slice(0, 8).map((source) => ({ ...source, excerpt: source.excerpt.slice(0, 1500) }))
    const peopleSources = sources.filter((source) => source.sourceKind !== 'registry')
    for (let index = 0; index < peopleSources.length; index += 24) groups.push([...new Map([...context, ...peopleSources.slice(index, index + 24)].map((source) => [source.id, source])).values()])
    const settled = await Promise.allSettled(groups.map((group) => this.extraction.extract(group, criteria)))
    const extracted = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    if (!extracted.length && groups.length) throw new BadGatewayException('Lead qualification is unavailable. Retry this search.')
    activity.push({ provider: 'Qwen', operation: 'people qualification', requests: groups.length, records: extracted.reduce((sum, result) => sum + result.candidates.length, 0), credits: null, status: extracted.length === groups.length ? 'ok' : 'partial' })
    const candidates = new Map<string, (typeof extracted)[number]['candidates'][number]>()
    for (const record of extracted.flatMap((result) => result.candidates)) {
      const previous = candidates.get(record.identityKey)
      if (!previous || record.matchedCriteria.length > previous.matchedCriteria.length || (record.matchedCriteria.length === previous.matchedCriteria.length && record.qualification.issues.length < previous.qualification.issues.length)) candidates.set(record.identityKey, record)
    }
    const snapshot: DiscoverySnapshot = { sources, companies, activity, queries, failedQueries }
    return { ...snapshot, candidates: [...candidates.values()].sort((a, b) => b.matchedCriteria.length - a.matchedCriteria.length || a.qualification.issues.length - b.qualification.issues.length).slice(0, 40), rejected: extracted.reduce((sum, result) => sum + result.rejected, 0) }
  }
}
