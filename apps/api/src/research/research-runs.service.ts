import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { db, type Prisma } from '@lead-trace/db'
import { AccountContextService, type AuthenticatedSession } from '../auth/account-context.service'
import type { CreateResearchRunDto } from './dto/create-research-run.dto'

@Injectable()
export class ResearchRunsService {
  constructor(private readonly accounts: AccountContextService) {}

  async create(session: AuthenticatedSession, input: CreateResearchRunDto) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const organizationId = membership.organizationId

    return db.$transaction(async (transaction) => {
      const emailKey = input.prospectEmail?.trim().toLowerCase() || null
      const existing = input.prospectId
        ? await transaction.prospect.findUnique({ where: { id_organizationId: { id: input.prospectId, organizationId } } })
        : null
      if (input.prospectId && !existing) throw new NotFoundException('Contact not found')
      const contactData = {
        organizationId, createdById: session.user.id, ownerId: session.user.id,
        name: input.prospectName, email: emailKey, emailKey,
        companyName: input.companyName, companyDomain: input.companyDomain,
        linkedinUrl: input.linkedinUrl, xHandle: input.xHandle,
      }
      const prospect = existing ?? (emailKey
        ? await transaction.prospect.upsert({ where: { organizationId_emailKey: { organizationId, emailKey } }, create: contactData, update: {} })
        : await transaction.prospect.create({ data: contactData }))
      // An email match links the existing contact without overwriting CRM data, but this run researches what was just submitted.
      const pick = (value: string | null | undefined, stored: string | null) => value?.trim() || stored
      const subject = existing ? prospect : { ...prospect, name: pick(input.prospectName, prospect.name) as string, companyName: pick(input.companyName, prospect.companyName), companyDomain: pick(input.companyDomain, prospect.companyDomain), linkedinUrl: pick(input.linkedinUrl, prospect.linkedinUrl), xHandle: pick(input.xHandle, prospect.xHandle) }
      if (![subject.companyName, subject.companyDomain, subject.linkedinUrl, subject.xHandle].some((value) => value?.trim())) {
        throw new BadRequestException('Add at least one identity anchor: company, company domain, LinkedIn URL, or X handle')
      }
      const offer = await transaction.offer.create({
        data: {
          organizationId,
          createdById: session.user.id,
          name: input.offerName,
          valueProposition: input.offerContext,
          targetPersona: input.targetPersona,
        },
      })
      return transaction.researchRun.create({
        data: {
          organizationId,
          createdById: session.user.id,
          prospectId: prospect.id,
          offerId: offer.id,
          goal: input.goal,
          inputSnapshot: {
            sender: {
              name: session.user.name,
            },
            prospect: {
              name: subject.name,
              email: subject.email,
              companyName: subject.companyName,
              companyDomain: subject.companyDomain,
              linkedinUrl: subject.linkedinUrl,
              xHandle: subject.xHandle,
            },
            offer: {
              name: offer.name,
              valueProposition: offer.valueProposition,
              targetPersona: offer.targetPersona,
            },
            goal: input.goal,
          },
        },
        include: { prospect: true, offer: true },
      })
    })
  }

  // Discovery marks a run running before its Tavily calls; if the API dies there, no worker ever claims it (no sources), so surface it as retryable.
  private failInterrupted(organizationId: string) {
    return db.researchRun.updateMany({ where: { organizationId, status: 'running', startedAt: { lt: new Date(Date.now() - 600000) }, sources: { none: {} } }, data: { status: 'failed', errorMessage: 'Source discovery was interrupted. Retry this research.' } })
  }

  async list(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    await this.failInterrupted(membership.organizationId)
    return db.researchRun.findMany({
      where: { organizationId: membership.organizationId },
      include: {
        prospect: true,
        offer: true,
        _count: { select: { evidence: true, sources: true } },
        brief: { select: { id: true, title: true, status: true, updatedAt: true, sections: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    })
  }

  async get(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    await this.failInterrupted(membership.organizationId)
    const run = await db.researchRun.findUnique({
      where: { id_organizationId: { id, organizationId: membership.organizationId } },
      include: {
        prospect: true,
        offer: true,
        sources: { orderBy: { retrievedAt: 'desc' } },
        evidence: { include: { source: true }, orderBy: { createdAt: 'asc' } },
        brief: true,
      },
    })
    if (!run) throw new NotFoundException('Research run not found')
    return run
  }

  async retry(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const organizationId = membership.organizationId
    const retried = await db.researchRun.updateMany({
      where: { id, organizationId, status: 'failed' },
      data: {
        status: 'queued',
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      },
    })
    if (retried.count !== 1) {
      const run = await db.researchRun.findUnique({
        where: { id_organizationId: { id, organizationId } },
        select: { status: true },
      })
      if (!run) throw new NotFoundException('Research run not found')
      throw new ConflictException(`Research run cannot be retried while ${run.status}`)
    }
    return db.researchRun.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { prospect: true, offer: true },
    })
  }

  async refresh(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const organizationId = membership.organizationId
    const run = await db.researchRun.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { brief: true },
    })
    if (!run) throw new NotFoundException('Research run not found')
    if (run.status !== 'completed') {
      throw new ConflictException(`Research run cannot be refreshed while ${run.status}`)
    }
    if (!run.brief) throw new ConflictException('Research run has no brief to refresh')

    await db.$transaction(async (transaction) => {
      await transaction.dealBrief.update({
        where: { id: run.brief!.id },
        data: {
          previousSections: run.brief!.sections as Prisma.InputJsonValue,
          status: 'refreshing',
        },
      })
      await transaction.researchRun.update({
        where: { id_organizationId: { id, organizationId } },
        data: {
          status: 'running',
          completedAt: null,
          errorMessage: null,
          lockedAt: null,
          lockExpiresAt: null,
          workerId: null,
        },
      })
    })

    return db.researchRun.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        prospect: true,
        offer: true,
        brief: true,
      },
    })
  }
}
