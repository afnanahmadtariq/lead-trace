import { Injectable, Logger } from '@nestjs/common'
import {
  buildWikipediaQueries,
  deduplicateWikipediaSources,
  scoreWikipediaHit,
  type WikipediaSource,
} from './wikipedia-discovery'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'LeadTrace-Research/0.1 (+https://leadtrace.online)'

type WikiSearchHit = { title?: string; snippet?: string }

@Injectable()
export class WikipediaDiscoveryService {
  private readonly log = new Logger(WikipediaDiscoveryService.name)

  async discover(prospect: { name: string; companyName: string | null }): Promise<WikipediaSource[]> {
    const queries = buildWikipediaQueries(prospect)
    const collected: WikipediaSource[] = []

    for (const item of queries) {
      try {
        const source = await this.resolveQuery(item.term, item.hints)
        if (source) collected.push(source)
      } catch (error) {
        this.log.warn(`Wikipedia lookup failed for "${item.term}": ${error instanceof Error ? error.message : error}`)
      }
    }

    return deduplicateWikipediaSources(collected)
  }

  private async resolveQuery(term: string, hints: string[]): Promise<WikipediaSource | null> {
    const direct = await this.fetchSummary(term.replace(/ /g, '_'))
    if (direct?.extract) {
      return {
        url: direct.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`,
        title: `Wikipedia · ${direct.title || term}`,
        publisher: 'Wikipedia',
        excerpt: direct.extract.slice(0, 12_000),
        score: 0.85,
        query: term,
      }
    }

    const hits = await this.search(term)
    let bestHit: WikiSearchHit | null = null
    let bestScore = -999
    for (const hit of hits) {
      const score = scoreWikipediaHit(hit, hints, term)
      if (score > bestScore) {
        bestScore = score
        bestHit = hit
      }
    }
    if (!bestHit?.title || bestScore <= 0) return null

    const resolved = await this.fetchSummary(bestHit.title.replace(/ /g, '_'))
    if (!resolved?.extract) return null
    return {
      url: resolved.pageUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(bestHit.title.replace(/ /g, '_'))}`,
      title: `Wikipedia · ${resolved.title || bestHit.title}`,
      publisher: 'Wikipedia',
      excerpt: resolved.extract.slice(0, 12_000),
      score: Math.min(0.95, 0.6 + bestScore / 100),
      query: term,
    }
  }

  private async search(term: string): Promise<WikiSearchHit[]> {
    const url = new URL(WIKI_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'search')
    url.searchParams.set('srsearch', term)
    url.searchParams.set('format', 'json')
    url.searchParams.set('srlimit', '5')
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Wikipedia search failed (${response.status})`)
    const payload = await response.json() as { query?: { search?: WikiSearchHit[] } }
    return payload.query?.search || []
  }

  private async fetchSummary(titleSlug: string) {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${titleSlug}`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Wikipedia summary failed (${response.status})`)
    const payload = await response.json() as {
      title?: string
      extract?: string
      content_urls?: { desktop?: { page?: string } }
    }
    return {
      title: payload.title || titleSlug.replace(/_/g, ' '),
      extract: String(payload.extract || '').trim(),
      pageUrl: payload.content_urls?.desktop?.page || null,
    }
  }
}
