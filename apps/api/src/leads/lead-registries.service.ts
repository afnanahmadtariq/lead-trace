import { Injectable } from '@nestjs/common'
import { normalizeIdentity, publicSourceUrl, type LeadSourceInput } from './lead-discovery'
import type { CompanyTarget, LeadCriteria, ProviderActivity, RegistryRecord } from './lead-types'

const USER_AGENT = 'LeadTrace/1.0 (https://leadtrace.online; hello@leadtrace.online)'
const text = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const companyKey = (value: string) => normalizeIdentity(value).replace(/\b(?:incorporated|inc|llc|ltd|limited|corporation|corp|plc|holdings|holding|group|the)\b/g, '').replace(/\s+/g, ' ').trim()
export function sameRegisteredCompany(left: string, right: string) { return Boolean(companyKey(left).length > 2 && companyKey(left) === companyKey(right)) }
export function countryCode(location?: string | null) {
  const value = normalizeIdentity(location || '')
  if (/\b(?:united states|usa|austin|new york|san francisco|california|boston|seattle)\b/.test(value) || value === 'us') return 'US'
  if (/\b(?:united kingdom|uk|london|england|scotland|wales)\b/.test(value)) return 'GB'
  if (/\b(?:united arab emirates|uae|dubai|abu dhabi|sharjah)\b/.test(value)) return 'AE'
  if (/\b(?:canada|toronto|vancouver)\b/.test(value)) return 'CA'
  if (/\b(?:germany|berlin|munich)\b/.test(value)) return 'DE'
  if (/\b(?:australia|sydney|melbourne)\b/.test(value)) return 'AU'
  if (value === 'india') return 'IN'
  return null
}
const countries: Record<string, string> = { US: 'United States', GB: 'United Kingdom', AE: 'United Arab Emirates', CA: 'Canada', DE: 'Germany', AU: 'Australia', IN: 'India' }
type GleifItem = { id?: string; attributes?: { entity?: { legalName?: { name?: string }; category?: string; status?: string; headquartersAddress?: { city?: string; country?: string }; legalAddress?: { city?: string; country?: string } }; registration?: { status?: string } } }
type SecTicker = { cik_str?: number; title?: string; ticker?: string }

@Injectable()
export class LeadRegistriesService {
  private secCache: { until: number; rows: SecTicker[] } | null = null
  private secPending: Promise<SecTicker[]> | null = null

  private async json<T>(url: string): Promise<T> {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, redirect: 'error' })
    if (!response.ok) throw new Error(`Registry returned HTTP ${response.status}`)
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Registry returned an empty response')
    const chunks: Uint8Array[] = []; let size = 0
    try { while (true) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > 3_000_000) throw new Error('Registry response exceeded its limit'); chunks.push(result.value) } }
    finally { await reader.cancel().catch(() => undefined) }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  }

  private gleifRecord(item: GleifItem): RegistryRecord | null {
    const entity = item.attributes?.entity, id = text(item.id, 20), name = text(entity?.legalName?.name)
    if (!/^[A-Z0-9]{20}$/.test(id) || !name || entity?.category === 'FUND' || /\b(?:ETF|trust|fund)\b/i.test(name)) return null
    const address = entity?.headquartersAddress || entity?.legalAddress
    return { provider: 'GLEIF', id, name, url: `https://api.gleif.org/api/v1/lei-records/${id}`, status: text(entity?.status) || 'Unknown', city: text(address?.city), country: countries[address?.country || ''] || text(address?.country), scope: entity?.headquartersAddress ? 'Reported headquarters' : 'Registered address' }
  }

  source(record: RegistryRecord, id: string): LeadSourceInput {
    return { id, url: record.url, title: `${record.provider}: ${record.name}`, publisher: new URL(record.url).hostname, queries: [], provider: record.provider.toLowerCase(), sourceKind: 'registry', excerpt: `Company: ${record.name}\nRegistry: ${record.provider}\nRegistry identifier: ${record.id}\nEntity status: ${record.status}\n${record.scope}: ${[record.city, record.country].filter(Boolean).join(', ')}\nRegistry data establishes company identity and reported address, not current employment, buyer role, industry fit, or buying intent.` }
  }

  async seed(criteria: LeadCriteria) {
    const sources: LeadSourceInput[] = [], activity: ProviderActivity[] = []
    const term = /saas|software|cloud/i.test(criteria.industry) ? 'software' : /marketing|agency/i.test(criteria.industry) ? 'marketing' : criteria.industry.replace(/\b(?:b2b|companies|company)\b/gi, '').trim().slice(0, 80)
    const url = new URL('https://api.gleif.org/api/v1/lei-records')
    url.searchParams.set('filter[fulltext]', term); url.searchParams.set('filter[entity.status]', 'ACTIVE'); url.searchParams.set('page[size]', '12')
    const country = countryCode(criteria.location); if (country) url.searchParams.set('filter[entity.legalAddress.country]', country)
    try {
      const payload = await this.json<{ data?: GleifItem[] }>(url.toString())
      for (const item of (payload.data || []).slice(0, 12)) { const record = this.gleifRecord(item); if (record) sources.push(this.source(record, `registry-seed-${sources.length + 1}`)) }
      activity.push({ provider: 'GLEIF', operation: 'company registry search', requests: 1, records: sources.length, credits: null, status: 'ok' })
    } catch { activity.push({ provider: 'GLEIF', operation: 'company registry search', requests: 1, records: 0, credits: null, status: 'unavailable', message: 'Registry search unavailable; web discovery continues.' }) }
    return { sources, activity }
  }

  private async secTickers() {
    if (this.secCache && this.secCache.until > Date.now()) return this.secCache.rows
    if (!this.secPending) this.secPending = this.json<Record<string, SecTicker>>('https://www.sec.gov/files/company_tickers.json').then((payload) => {
      const rows = Object.values(payload).slice(0, 15000); this.secCache = { rows, until: Date.now() + 86400000 }; return rows
    }).finally(() => { this.secPending = null })
    return this.secPending
  }

  async enrich(company: CompanyTarget, criteria: LeadCriteria) {
    const records: RegistryRecord[] = [], activity: ProviderActivity[] = []
    const tasks: Promise<void>[] = []
    tasks.push((async () => {
      const url = new URL('https://api.gleif.org/api/v1/lei-records')
      url.searchParams.set('filter[fulltext]', company.name); url.searchParams.set('page[size]', '5')
      const country = countryCode(criteria.location); if (country) url.searchParams.set('filter[entity.legalAddress.country]', country)
      try {
        const data = await this.json<{ data?: GleifItem[] }>(url.toString())
        const matches = (data.data || []).flatMap((item) => { const record = this.gleifRecord(item); return record && sameRegisteredCompany(record.name, company.name) ? [record] : [] }).slice(0, 2)
        records.push(...matches); activity.push({ provider: 'GLEIF', operation: 'company identity lookup', requests: 1, records: matches.length, credits: null, status: 'ok' })
      } catch { activity.push({ provider: 'GLEIF', operation: 'company identity lookup', requests: 1, records: 0, credits: null, status: 'unavailable' }) }
    })())
    tasks.push((async () => {
      try {
        const url = new URL('https://www.wikidata.org/w/api.php'); url.searchParams.set('action', 'wbsearchentities'); url.searchParams.set('search', company.name); url.searchParams.set('language', 'en'); url.searchParams.set('format', 'json'); url.searchParams.set('limit', '3')
        const data = await this.json<{ search?: { id?: string; label?: string }[] }>(url.toString())
        const match = data.search?.find((item) => item.label && sameRegisteredCompany(item.label, company.name) && /^Q\d+$/.test(item.id || ''))
        let count = 0
        if (match?.id) {
          const entity = await this.json<{ entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }> }>(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${match.id}&props=claims&format=json`)
          const websites = entity.entities?.[match.id]?.claims?.P856 || []
          const confirmedDomain = websites.some((claim) => { const value = claim.mainsnak?.datavalue?.value; try { return Boolean(company.domain && typeof value === 'string' && new URL(value).hostname.replace(/^www\./, '') === company.domain) } catch { return false } })
          if (confirmedDomain) { records.push({ provider: 'Wikidata', id: match.id, name: company.name, url: `https://www.wikidata.org/wiki/${match.id}`, status: 'Website corroborated', city: '', country: '', scope: `Website: ${company.domain}` }); count = 1 }
        }
        activity.push({ provider: 'Wikidata', operation: 'company website corroboration', requests: match ? 2 : 1, records: count, credits: null, status: 'ok' })
      } catch { activity.push({ provider: 'Wikidata', operation: 'company website corroboration', requests: 1, records: 0, credits: null, status: 'unavailable' }) }
    })())
    if (countryCode(criteria.location) === 'US') tasks.push((async () => {
      try {
        const ticker = (await this.secTickers()).find((item) => item.title && sameRegisteredCompany(item.title, company.name))
        let count = 0
        if (ticker?.cik_str && Number.isInteger(ticker.cik_str)) {
          const id = String(ticker.cik_str).padStart(10, '0')
          const data = await this.json<{ name?: string; addresses?: { business?: { city?: string; stateOrCountryDescription?: string } }; sicDescription?: string }>(`https://data.sec.gov/submissions/CIK${id}.json`)
          if (data.name && sameRegisteredCompany(data.name, company.name)) { records.push({ provider: 'SEC EDGAR', id, name: data.name, url: `https://www.sec.gov/edgar/browse/?CIK=${id}`, status: 'EDGAR filer', city: [text(data.addresses?.business?.city), text(data.addresses?.business?.stateOrCountryDescription)].filter(Boolean).join(', '), country: '', scope: `Reported business address; SIC: ${text(data.sicDescription)}` }); count = 1 }
        }
        activity.push({ provider: 'SEC EDGAR', operation: 'public-company lookup', requests: ticker ? 2 : 1, records: count, credits: null, status: 'ok' })
      } catch { activity.push({ provider: 'SEC EDGAR', operation: 'public-company lookup', requests: 1, records: 0, credits: null, status: 'unavailable' }) }
    })())
    await Promise.all(tasks)
    return { records: records.filter((record) => publicSourceUrl(record.url)), activity }
  }
}
