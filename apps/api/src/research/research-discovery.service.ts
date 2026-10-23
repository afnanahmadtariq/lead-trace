import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { db } from '@lead-trace/db'
import { AccountContextService, type AuthenticatedSession } from '../auth/account-context.service'
import { TavilySearchService } from '../tavily/tavily-search.service'
import {
  buildDiscoveryQueries,
  deduplicateDiscoveredSources,
  filterDiscoveryBatches,
  type DiscoveredSource,
  type ProspectDiscoveryInput,
} from './research-discovery'
import { WikipediaDiscoveryService } from './wikipedia-discovery.service'

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Source discovery failed'
  return message.slice(0, 1_000)
}

@Injectable()
export class ResearchDiscoveryService {
  private readonly log = new Logger(ResearchDiscoveryService.name)

  constructor(
    private readonly accounts: AccountContextService,
    private readonly tavily: TavilySearchService,
    private readonly wikipedia: WikipediaDiscoveryService,
  ) {}

  async discover(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const organizationId = membership.organizationId
    const run = await db.researchRun.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { prospect: true },
    })
    if (!run) throw new NotFoundException('Research run not found')
    if (run.status !== 'queued') throw new ConflictException(`Research run cannot start discovery while ${run.status}`)

    const claimed = await db.researchRun.updateMany({
      where: { id, organizationId, status: 'queued' },
      data: { status: 'running', startedAt: new Date(), errorMessage: null },
    })
    if (claimed.count !== 1) throw new ConflictException('Research run has already been claimed')

    // Research the identity submitted with this run; an email-matched CRM contact may hold older details.
    const prospect = { ...run.prospect, ...(run.inputSnapshot as { prospect?: Partial<ProspectDiscoveryInput> } | null)?.prospect }
    try {
      const queries = buildDiscoveryQueries(prospect)
      const settled = await Promise.allSettled(queries.map((item) => this.tavily.search({ ...item, sessionId: run.id })))
      const batches = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      const failedQueries = settled.length - batches.length
      const relevantBatches = filterDiscoveryBatches(batches, prospect)
      let sources: DiscoveredSource[] = relevantBatches.length ? deduplicateDiscoveredSources(relevantBatches) : []
      let wikipediaSources = 0

      if (!sources.length) {
        this.log.warn('Tavily returned no sources for run=%s; falling back to Wikipedia', run.id)
        const fallback = await this.wikipedia.discover(prospect)
        const fallbackBatches = fallback.map((source) => ({
          kind: 'wikipedia-fallback',
          query: source.query,
          requestId: 'wikipedia',
          responseTimeMs: 0,
          credits: null,
          sources: [{
            url: source.url,
            title: source.title,
            publisher: source.publisher,
            excerpt: source.excerpt,
            publishedAt: null,
            score: source.score,
          }],
        }))
        sources = deduplicateDiscoveredSources(filterDiscoveryBatches(fallbackBatches, prospect))
        wikipediaSources = sources.length
      }

      if (!sources.length) {
        throw new UnprocessableEntityException('No public sources were found for the supplied prospect identifiers')
      }

      await db.$transaction(sources.map((source) => db.evidenceSource.upsert({
        where: {
          researchRunId_organizationId_url: {
            researchRunId: run.id,
            organizationId,
            url: source.url,
          },
        },
        create: {
          organizationId,
          researchRunId: run.id,
          url: source.url,
          title: source.title,
          publisher: source.publisher,
          sourceType: source.matches.some((match) => match.kind === 'wikipedia-fallback') ? 'wikipedia' : 'tavily-search',
          publishedAt: source.publishedAt,
          excerpt: source.excerpt,
          metadata: {
            provider: source.matches.some((match) => match.kind === 'wikipedia-fallback') ? 'wikipedia' : 'tavily',
            matches: source.matches,
          },
        },
        update: {
          title: source.title,
          publisher: source.publisher,
          sourceType: source.matches.some((match) => match.kind === 'wikipedia-fallback') ? 'wikipedia' : 'tavily-search',
          publishedAt: source.publishedAt,
          retrievedAt: new Date(),
          excerpt: source.excerpt,
          metadata: {
            provider: source.matches.some((match) => match.kind === 'wikipedia-fallback') ? 'wikipedia' : 'tavily',
            matches: source.matches,
          },
        },
      })))

      return {
        researchRunId: run.id,
        status: 'running',
        sourcesCollected: sources.length,
        queriesCompleted: batches.length,
        failedQueries,
        wikipediaSources,
      }
    } catch (error) {
      await db.researchRun.updateMany({
        where: { id: run.id, organizationId, status: 'running' },
        data: { status: 'failed', errorMessage: safeErrorMessage(error) },
      })
      throw error
    }
  }
}
