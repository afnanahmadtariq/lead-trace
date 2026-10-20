import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { db, type Prisma } from '@lead-trace/db'
import { AccountContextService, type AuthenticatedSession } from '../auth/account-context.service'
import type { CreateResearchRunDto } from './dto/create-research-run.dto'

@Injectable()
export class ResearchRunsService {
  constructor(private readonly accounts: AccountContextService) {}

  async create(session: AuthenticatedSession, input: CreateResearchRunDto) {
    if (![input.companyName, input.companyDomain, input.linkedinUrl, input.xHandle].some((value) => value?.trim())) {
      throw new BadRequestException(
        'Add at least one identity anchor: company, company domain, LinkedIn URL, or X handle',
      )
    }
    const membership = await this.accounts.assertActiveWorkspace(session)
    const organizationId = membership.organizationId

    return db.$transaction(async (transaction) => {
      const prospect = await transaction.prospect.create({
        data: {
          organizationId,
          createdById: session.user.id,
          name: input.prospectName,
          email: input.prospectEmail,
          companyName: input.companyName,
          companyDomain: input.companyDomain,
          linkedinUrl: input.linkedinUrl,
          xHandle: input.xHandle,
        },
      })
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
              name: prospect.name,
              email: prospect.email,
              companyName: prospect.companyName,
              companyDomain: prospect.companyDomain,
              linkedinUrl: prospect.linkedinUrl,
              xHandle: prospect.xHandle,
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

  async list(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
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
