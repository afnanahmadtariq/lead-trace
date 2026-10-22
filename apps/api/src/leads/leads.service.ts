import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { db, type Prisma } from '@lead-trace/db'
import { randomUUID } from 'node:crypto'
import type { AuthenticatedSession } from '../auth/account-context.service'
import { CrmService } from '../crm/crm.service'
import { deduplicateDiscoveredSources } from '../research/research-discovery'
import { TavilySearchService } from '../tavily/tavily-search.service'
import { buildLeadQueries, publicSourceUrl } from './lead-discovery'
import { LeadExtractionService } from './lead-extraction.service'
import type { ConvertLeadDto, CreateLeadSearchDto, ReviewLeadDto } from './leads.dto'

@Injectable()
export class LeadsService {
  constructor(private readonly crm: CrmService, private readonly tavily: TavilySearchService, private readonly extraction: LeadExtractionService, private readonly config: ConfigService) {}

  async capabilities(session: AuthenticatedSession) {
    await this.crm.scope(session)
    return { discoveryConfigured: Boolean(this.config.get<string>('TAVILY_API_KEY')?.trim()), extractionConfigured: this.extraction.configured(), maxCandidates: 20, queriesPerSearch: 3 }
  }

  async create(session: AuthenticatedSession, input: CreateLeadSearchDto) {
    const organizationId = await this.crm.scope(session)
    const capabilities = await this.capabilities(session)
    if (!capabilities.discoveryConfigured || !capabilities.extractionConfigured) throw new ServiceUnavailableException('Configure Tavily and the model provider before generating leads')
    return db.$transaction(async (tx) => {
      // Serialize the quota check across API instances without locking CRM records.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`lead-search:${organizationId}`}, 0))`
      const active = await tx.leadSearch.count({ where: { organizationId, status: { in: ['queued', 'running'] }, createdAt: { gt: new Date(Date.now() - 30 * 60000) } } })
      if (active >= 3) throw new ConflictException('Finish or cancel an active search before starting another')
      return tx.leadSearch.create({ data: { ...input, organizationId, createdById: session.user.id } })
    })
  }

  async list(session: AuthenticatedSession, page = 1) {
    const organizationId = await this.crm.scope(session)
    if (!Number.isInteger(page) || page < 1 || page > 200000) throw new BadRequestException('Invalid page')
    const where = { organizationId }
    const [items, total] = await db.$transaction([
      db.leadSearch.findMany({ where, include: { _count: { select: { candidates: true, sources: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (page - 1) * 25 }),
      db.leadSearch.count({ where }),
    ])
    return { items, total, page, pageSize: 25 }
  }

  async get(session: AuthenticatedSession, id: string) {
    const organizationId = await this.crm.scope(session)
    const search = await db.leadSearch.findUnique({ where: { id_organizationId: { id, organizationId } }, include: {
      sources: { orderBy: { retrievedAt: 'asc' } },
      candidates: { include: { source: true, prospect: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
    } })
    if (!search) throw new NotFoundException('Lead search not found')
    return { ...search, interrupted: search.status === 'running' && Boolean(search.lockExpiresAt && search.lockExpiresAt.getTime() <= Date.now()) }
  }

  async discover(session: AuthenticatedSession, id: string) {
    const organizationId = await this.crm.scope(session)
    const search = await db.leadSearch.findUnique({ where: { id_organizationId: { id, organizationId } } })
    if (!search) throw new NotFoundException('Lead search not found')
    if (!this.config.get<string>('TAVILY_API_KEY') || !this.extraction.configured()) throw new ServiceUnavailableException('Configure Tavily and the model provider before generating leads')
    const attemptToken = randomUUID(), now = new Date()
    const claim = await db.leadSearch.updateMany({ where: { id, organizationId, attemptCount: { lt: 5 }, OR: [ { status: { in: ['queued', 'failed'] } }, { status: 'running', lockExpiresAt: { lte: now } } ] }, data: { status: 'running', attemptToken, attemptCount: { increment: 1 }, lockExpiresAt: new Date(Date.now() + 120000), startedAt: now, completedAt: null, errorMessage: null } })
    if (!claim.count) throw new ConflictException('This search is already running, finished, cancelled, or has reached its retry limit')
    try {
      const criteria = { industry: search.industry, role: search.role, location: search.location || undefined, keywords: search.keywords || undefined }
      const queries = buildLeadQueries(criteria)
      const settled = await Promise.allSettled(queries.map((query) => this.tavily.search({ ...query, sessionId: id })))
      const batches = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      if (!batches.length) throw new BadGatewayException('Web discovery is unavailable. Retry this search.')
      const sources = deduplicateDiscoveredSources(batches).filter((source) => source.score >= 0.3 && source.excerpt && publicSourceUrl(source.url)).slice(0, 18).map((source, index) => ({ id: `s${index + 1}`, url: publicSourceUrl(source.url)!, title: source.title, publisher: source.publisher, excerpt: source.excerpt!, queries: [...new Set(source.matches.map((match) => match.query))] }))
      const extracted = sources.length ? await this.extraction.extract(sources, criteria) : { candidates: [], rejected: 0 }
      return await db.$transaction(async (tx) => {
        const saved = await tx.leadSearch.updateMany({ where: { id, organizationId, status: 'running', attemptToken, lockExpiresAt: { gt: new Date() } }, data: { status: 'completed', completedAt: new Date(), lockExpiresAt: null, attemptToken: null, queries: queries as unknown as Prisma.InputJsonValue, failedQueries: queries.length - batches.length, rejectedCandidates: extracted.rejected } })
        if (!saved.count) throw new ConflictException('Search was cancelled or superseded. Refresh to see its current state.')
        const sourceIds = new Map<string, string>()
        for (const source of sources) {
          const sourceId = randomUUID(); sourceIds.set(source.id, sourceId)
          await tx.leadSource.create({ data: { ...source, id: sourceId, organizationId, searchId: id } })
        }
        for (const candidate of extracted.candidates) {
          const sourceId = sourceIds.get(candidate.sourceId)
          if (!sourceId) throw new BadGatewayException('Lead source reference was not found')
          await tx.leadCandidate.create({ data: { ...candidate, sourceId, organizationId, searchId: id } })
        }
        return { id, status: 'completed', candidatesFound: extracted.candidates.length }
      }, { timeout: 10000 })
    } catch (error) {
      const message = error instanceof BadGatewayException || error instanceof ServiceUnavailableException ? error.message : 'Lead generation could not finish. Retry this search.'
      await db.leadSearch.updateMany({ where: { id, organizationId, status: 'running', attemptToken }, data: { status: 'failed', errorMessage: message, lockExpiresAt: null, attemptToken: null } })
      throw error
    }
  }

  async cancel(session: AuthenticatedSession, id: string) {
    const organizationId = await this.crm.scope(session)
    const search = await db.leadSearch.findUnique({ where: { id_organizationId: { id, organizationId } }, select: { status: true } })
    if (!search) throw new NotFoundException('Lead search not found')
    const result = await db.leadSearch.updateMany({ where: { id, organizationId, status: { in: ['queued', 'running', 'failed'] } }, data: { status: 'cancelled', attemptToken: null, lockExpiresAt: null, completedAt: new Date() } })
    if (!result.count) throw new ConflictException('Only an active or failed search can be cancelled')
    return { id, status: 'cancelled' }
  }

  async review(session: AuthenticatedSession, id: string, status: ReviewLeadDto['status']) {
    const organizationId = await this.crm.scope(session)
    const candidate = await db.leadCandidate.findUnique({ where: { id_organizationId: { id, organizationId } } })
    if (!candidate) throw new NotFoundException('Lead not found')
    const result = await db.leadCandidate.updateMany({ where: { id, organizationId, status: { not: 'converted' } }, data: { status, reviewedById: session.user.id, reviewedAt: new Date() } })
    if (!result.count) throw new ConflictException('This lead has already been saved to CRM')
    return { id, status }
  }

  async convert(session: AuthenticatedSession, id: string, input: ConvertLeadDto) {
    const organizationId = await this.crm.scope(session)
    const ownerId = await this.crm.owner(organizationId, input.ownerId === undefined ? session.user.id : input.ownerId)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          const candidate = await tx.leadCandidate.findUnique({ where: { id_organizationId: { id, organizationId } } })
          if (!candidate) throw new NotFoundException('Lead not found')
          if (candidate.status === 'converted' && candidate.prospectId) return { prospectId: candidate.prospectId, reused: true }
          if (candidate.status !== 'qualified') throw new ConflictException('Qualify this lead before saving it to CRM')
          const companyName = input.companyName || candidate.companyName, email = input.email?.toLowerCase() || null
          const matches = input.existingContactId
            ? await tx.prospect.findMany({ where: { id: input.existingContactId, organizationId }, take: 1 })
            : await tx.prospect.findMany({ where: { organizationId, OR: [ ...(email ? [{ emailKey: email }] : []), { name: { equals: input.name, mode: 'insensitive' }, companyName: { equals: companyName, mode: 'insensitive' } } ] }, take: 2 })
          if (input.existingContactId && !matches.length) throw new NotFoundException('Contact not found')
          if (matches.length > 1) throw new ConflictException('Multiple CRM contacts match. Choose the existing contact to link.')
          const prospect = matches[0] ?? await tx.prospect.create({ data: { organizationId, createdById: session.user.id, ownerId, name: input.name, email, emailKey: email, companyName, companyDomain: input.companyDomain || null, jobTitle: input.jobTitle || candidate.jobTitle, phone: input.phone || null, lifecycle: input.lifecycle || 'qualified' } })
          await tx.leadCandidate.update({ where: { id_organizationId: { id, organizationId } }, data: { status: 'converted', prospectId: prospect.id, reviewedById: session.user.id, reviewedAt: new Date() } })
          return { prospectId: prospect.id, reused: matches.length > 0 }
        }, { isolationLevel: 'Serializable' })
      } catch (error) {
        const conflict = error as { code?: string; cause?: { originalCode?: string; kind?: string } }
        const retryable = ['P2034', 'P2002'].includes(conflict.code || '') || ['40001', '40P01'].includes(conflict.cause?.originalCode || '') || conflict.cause?.kind === 'TransactionWriteConflict'
        if (retryable && attempt < 2) continue
        if (retryable) throw new ConflictException('CRM changed while saving this lead. Try again.')
        throw error
      }
    }
    throw new ConflictException('CRM changed while saving this lead. Try again.')
  }
}
