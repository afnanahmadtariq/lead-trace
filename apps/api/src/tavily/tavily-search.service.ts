import { BadGatewayException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TavilyKeylessLimitError, type TavilyClient, type TavilySearchResponse } from '@tavily/core'
import { TAVILY_CLIENT } from './tavily.constants'

export type TavilySearchTopic = 'general' | 'news'
export type TavilySearchDepth = 'basic' | 'advanced' | 'fast' | 'ultra-fast'

export type TavilySource = {
  url: string
  title: string
  publisher: string
  excerpt: string | null
  publishedAt: Date | null
  score: number
}

export type TavilySearchBatch = {
  kind: string
  query: string
  requestId: string
  responseTimeMs: number
  credits: number | null
  sources: TavilySource[]
}

export type TavilyDiscoveryQuery = {
  kind: string
  query: string
  topic: TavilySearchTopic
  days?: number
  sessionId?: string
}

type TavilySearchResult = TavilySearchResponse['results'][number]

const TRACKING_PARAMETERS = new Set(['fbclid', 'gclid', 'ref', 'ref_src'])

function canonicalHttpUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }
    url.searchParams.sort()
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch {
    return null
  }
}

function publishedDate(value: string | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeTavilyResult(result: TavilySearchResult): TavilySource | null {
  const url = canonicalHttpUrl(result.url)
  if (!url) return null
  const parsedUrl = new URL(url)
  const title = result.title?.trim() || parsedUrl.hostname
  const excerpt = result.content?.trim().slice(0, 2_000) || null
  return {
    url,
    title: title.slice(0, 500),
    publisher: parsedUrl.hostname.replace(/^www\./, ''),
    excerpt,
    publishedAt: publishedDate(result.publishedDate),
    score: Number.isFinite(result.score) ? result.score : 0,
  }
}

@Injectable()
export class TavilySearchService {
  private readonly logger = new Logger(TavilySearchService.name)

  constructor(
    @Inject(TAVILY_CLIENT) private readonly client: TavilyClient,
    private readonly config: ConfigService,
  ) {}

  async extractPages(urls: string[], query: string, sessionId: string) {
    const response = await this.client.extract(urls.slice(0, 16), { extractDepth: 'advanced', format: 'text', query: query.slice(0, 400), chunksPerSource: 5, includeUsage: true, timeout: 20, sessionId })
    return { sources: response.results.map((result) => ({ url: result.url, title: result.title || new URL(result.url).hostname, publisher: new URL(result.url).hostname.replace(/^www\./, ''), excerpt: result.rawContent.slice(0, 10000), publishedAt: null, score: 1 })), failed: response.failedResults.length, credits: response.usage?.credits ?? null }
  }

  async crawlCompany(url: string, role: string, sessionId: string) {
    const response = await this.client.crawl(url, { maxDepth: 1, maxBreadth: 3, limit: 3, instructions: `Find current leadership, management, team, about and sales leadership pages. Relevant role: ${role.slice(0, 100)}.`, allowExternal: false, extractDepth: 'advanced', format: 'text', includeUsage: true, timeout: 25, sessionId })
    return { sources: response.results.map((result) => ({ url: result.url, title: `${new URL(result.url).hostname} ${new URL(result.url).pathname}`, publisher: new URL(result.url).hostname.replace(/^www\./, ''), excerpt: result.rawContent.slice(0, 10000), publishedAt: null, score: 1 })), credits: response.usage?.credits ?? null }
  }

  async search(input: TavilyDiscoveryQuery): Promise<TavilySearchBatch> {
    const query = input.query.trim()
    if (!query || query.length > 400) throw new Error('Tavily queries must contain between 1 and 400 characters')

    try {
      const response = await this.client.search(query, {
        searchDepth: this.config.get<TavilySearchDepth>('TAVILY_SEARCH_DEPTH') ?? 'advanced',
        maxResults: this.config.get<number>('TAVILY_MAX_RESULTS') ?? 6,
        topic: input.topic,
        days: input.days,
        includeAnswer: false,
        includeImages: false,
        includeRawContent: false,
        includeUsage: true,
        sessionId: input.sessionId,
        timeout: 20,
      })

      return {
        kind: input.kind,
        query,
        requestId: response.requestId,
        responseTimeMs: Math.round(response.responseTime * 1_000),
        credits: response.usage?.credits ?? null,
        sources: response.results.flatMap((result) => {
          const source = normalizeTavilyResult(result)
          return source ? [source] : []
        }),
      }
    } catch (error) {
      if (error instanceof TavilyKeylessLimitError) {
        throw new ServiceUnavailableException('Web discovery has reached its shared limit; configure TAVILY_API_KEY to continue')
      }
      this.logger.error(`Tavily search failed: ${error instanceof Error ? error.message : 'unknown provider error'}`)
      throw new BadGatewayException('The web discovery provider is temporarily unavailable')
    }
  }
}
