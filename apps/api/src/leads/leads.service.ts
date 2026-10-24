import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { db, type Prisma } from '@lead-trace/db'
import { randomUUID } from 'node:crypto'
import type { AuthenticatedSession } from '../auth/account-context.service'
import { CrmService } from '../crm/crm.service'
import { LeadDeepDiscoveryService } from './lead-deep-discovery.service'
import { LeadExtractionService } from './lead-extraction.service'
import type { ConvertLeadDto, CreateLeadSearchDto, ReviewLeadDto } from './leads.dto'

@Injectable()
export class LeadsService {
  constructor(private readonly crm: CrmService, private readonly extraction: LeadExtractionService, private readonly config: ConfigService, private readonly discovery: LeadDeepDiscoveryService) {}

  async capabilities(session: AuthenticatedSession) {
    await this.crm.scope(session)
    return { discoveryConfigured: Boolean(this.config.get<string>('TAVILY_API_KEY')?.trim()), extractionConfigured: this.extraction.configured(), maxCandidates: 40, queriesPerSearch: 30, publicRegistries: ['GLEIF', 'Wikidata', 'SEC EDGAR'], modes: ['quick', 'deep'] }
  }

  async create(session: AuthenticatedSession, input: CreateLeadSearchDto) {
    const organizationId = await this.crm.scope(session)
    if (!this.config.get<string>('TAVILY_API_KEY')?.trim() || !this.extraction.configured()) throw new ServiceUnavailableException('Configure Tavily and an enabled model provider before generating leads')
    return db.$transaction(async (tx) => {
      // Serialize the quota check across API instances without locking CRM records.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`lead-search:${organizationId}`}, 0))`
      const active = await tx.leadSearch.count({ where: { organizationId, status: { in: ['queued', 'running'] }, createdAt: { gt: new Date(Date.now() - 30 * 60000) } } })
      if (active >= 3) throw new ConflictException('Finish or cancel an active search before starting another')
      return tx.leadSearch.create({ data: { ...input, depth: input.depth || 'deep', roleMatch: input.roleMatch || 'function', organizationId, createdById: session.user.id } })
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

  async requestDiscovery(session: AuthenticatedSession, id: string) {
    const organizationId = await this.crm.scope(session)
    const search = await db.leadSearch.findUnique({ where: { id_organizationId: { id, organizationId } } })
    if (!search) throw new NotFoundException('Lead search not found')
    if (search.status === 'queued' || (search.status === 'running' && search.lockExpiresAt && search.lockExpiresAt > new Date())) return { id, status: search.status }
    const reset = await db.leadSearch.updateMany({ where: { id, organizationId, attemptCount: { lt: 5 }, OR: [{ status: 'failed' }, { status: 'running', lockExpiresAt: { lte: new Date() } }] }, data: { status: 'queued', phase: 'queued', attemptToken: null, lockExpiresAt: null, errorMessage: null } })
    if (!reset.count) throw new ConflictException('This search is finished, cancelled, or has reached its retry limit')
    return { id, status: 'queued' }
  }

  async processNext() {
    // A crash on the final attempt leaves an expired lease that no claim or retry accepts; settle it so the search is not stuck running.
    await db.leadSearch.updateMany({ where: { status: 'running', lockExpiresAt: { lte: new Date() }, attemptCount: { gte: 5 } }, data: { status: 'failed', phase: 'failed', errorMessage: 'Lead generation could not finish after 5 attempts.', lockExpiresAt: null, attemptToken: null } })
    const search = await db.leadSearch.findFirst({ where: { attemptCount: { lt: 5 }, OR: [{ status: 'queued' }, { status: 'running', lockExpiresAt: { lte: new Date() } }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, organizationId: true } })
    if (!search) return false
    await this.executeDiscovery(search.id, search.organizationId)
    return true
  }

  async discover(session: AuthenticatedSession, id: string) {
    return this.executeDiscovery(id, await this.crm.scope(session))
  }

  private async executeDiscovery(id: string, organizationId: string) {
    const search = await db.leadSearch.findUnique({ where: { id_organizationId: { id, organizationId } } })
    if (!search) throw new NotFoundException('Lead search not found')
    if (!this.config.get<string>('TAVILY_API_KEY') || !this.extraction.configured()) throw new ServiceUnavailableException('Configure Tavily and an enabled model provider before generating leads')
    const attemptToken = randomUUID(), now = new Date()
    const claim = await db.leadSearch.updateMany({ where: { id, organizationId, attemptCount: { lt: 5 }, OR: [{ status: { in: ['queued', 'failed'] } }, { status: 'running', lockExpiresAt: { lte: now } }] }, data: { status: 'running', phase: 'discovering', attemptToken, attemptCount: { increment: 1 }, lockExpiresAt: new Date(Date.now() + 300000), startedAt: now, completedAt: null, errorMessage: null } })
    if (!claim.count) throw new ConflictException('This search is already running, finished, cancelled, or has reached its retry limit')
    const guard = { id, organizationId, status: 'running', attemptToken }
    const heartbeat = setInterval(() => { void db.leadSearch.updateMany({ where: guard, data: { lockExpiresAt: new Date(Date.now() + 300000) } }).catch(() => undefined) }, 15000)
    heartbeat.unref()
    try {
      const criteria = { industry: search.industry, role: search.role, location: search.location || undefined, keywords: search.keywords || undefined, roleMatch: search.roleMatch as 'exact' | 'function' }
      const extracted = await this.discovery.run(criteria, search.depth, id, async (progress) => {
        const updated = await db.leadSearch.updateMany({ where: guard, data: { phase: progress.phase, progress: { ...progress } } })
        if (!updated.count) throw new ConflictException('Search was cancelled or superseded. Refresh to see its current state.')
      })
      return await db.$transaction(async (tx) => {
        const saved = await tx.leadSearch.updateMany({ where: { ...guard, lockExpiresAt: { gt: new Date() } }, data: { status: 'completed', phase: 'completed', completedAt: new Date(), lockExpiresAt: null, attemptToken: null, queries: extracted.queries as unknown as Prisma.InputJsonValue, failedQueries: extracted.failedQueries, rejectedCandidates: extracted.rejected, diagnostics: { activity: extracted.activity, totalQueries: extracted.queries.length } as unknown as Prisma.InputJsonValue } })
        if (!saved.count) throw new ConflictException('Search was cancelled or superseded. Refresh to see its current state.')
        const sourceIds = new Map<string, string>()
        for (const source of extracted.sources) {
          const sourceId = randomUUID(); sourceIds.set(source.id, sourceId)
          await tx.leadSource.create({ data: { id: sourceId, organizationId, searchId: id, url: source.url, title: source.title, publisher: source.publisher, excerpt: source.excerpt, queries: source.queries, provider: source.provider || 'tavily', sourceKind: source.sourceKind || 'search' } })
        }
        for (const candidate of extracted.candidates) {
          const sourceId = sourceIds.get(candidate.sourceId)
          if (!sourceId) throw new BadGatewayException('Lead source reference was not found')
          const qualification = { ...candidate.qualification, evidence: Object.fromEntries(Object.entries(candidate.qualification.evidence).map(([key, proof]) => { const sourceId = sourceIds.get(proof.sourceId); if (!sourceId) throw new BadGatewayException('Criterion source reference was not found'); return [key, { ...proof, sourceId }] })) }
          await tx.leadCandidate.create({ data: { ...candidate, qualification, sourceId, organizationId, searchId: id } })
        }
        // Company snapshots reference the same persisted sources as the people evidence.
        await tx.leadSearch.update({ where: { id }, data: { companySnapshots: extracted.companies.map((company) => ({ ...company, sourceId: sourceIds.get(company.sourceId) || null })) as unknown as Prisma.InputJsonValue } })
        return { id, status: 'completed', candidatesFound: extracted.candidates.length }
      }, { timeout: 15000 })
    } catch (error) {
      const message = error instanceof BadGatewayException || error instanceof ServiceUnavailableException ? error.message : 'Lead generation could not finish. Retry this search.'
      await db.leadSearch.updateMany({ where: guard, data: { status: 'failed', phase: 'failed', errorMessage: message, lockExpiresAt: null, attemptToken: null } })
      throw error
    } finally { clearInterval(heartbeat) }
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
            : await tx.prospect.findMany({ where: { organizationId, OR: [ ...(email ? [{ emailKey: email }] : [{ name: { equals: input.name, mode: 'insensitive' as const }, companyName: { equals: companyName, mode: 'insensitive' as const } }]) ] }, take: 2 })
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
