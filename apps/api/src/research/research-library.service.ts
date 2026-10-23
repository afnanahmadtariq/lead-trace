import { GoneException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { db } from '@lead-trace/db'
import { randomBytes } from 'node:crypto'
import { AccountContextService, type AuthenticatedSession } from '../auth/account-context.service'

@Injectable()
export class ResearchLibraryService {
  constructor(
    private readonly accounts: AccountContextService,
    private readonly config: ConfigService,
  ) {}

  async evidence(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const organizationId = membership.organizationId
    const [sources, evidence] = await Promise.all([
      db.evidenceSource.findMany({
        where: { organizationId },
        include: {
          researchRun: {
            select: {
              id: true,
              goal: true,
              prospect: { select: { name: true, companyName: true } },
              offer: { select: { name: true } },
            },
          },
          _count: { select: { evidence: true } },
        },
        orderBy: { retrievedAt: 'desc' },
        take: 200,
      }),
      db.evidence.findMany({
        where: { organizationId },
        include: {
          source: { select: { title: true, url: true, publisher: true } },
          researchRun: {
            select: {
              id: true,
              prospect: { select: { name: true, companyName: true } },
              offer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])
    return { sources, evidence }
  }

  async briefs(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    return db.dealBrief.findMany({
      where: { organizationId: membership.organizationId },
      select: {
        id: true,
        title: true,
        status: true,
        generatedAt: true,
        updatedAt: true,
        sections: true,
        researchRun: {
          select: {
            id: true,
            goal: true,
            prospect: { select: { name: true, companyName: true } },
            offer: { select: { name: true } },
            _count: { select: { evidence: true, sources: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
  }

  async brief(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const brief = await db.dealBrief.findFirst({
      where: { id, organizationId: membership.organizationId },
      include: {
        share: { select: { token: true, createdAt: true, revokedAt: true } },
        researchRun: {
          include: {
            prospect: true,
            offer: true,
            evidence: { include: { source: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    })
    if (!brief) throw new NotFoundException('Deal brief not found')
    return brief
  }

  async shareBrief(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const brief = await db.dealBrief.findFirst({
      where: { id, organizationId: membership.organizationId },
      select: { id: true, organizationId: true, share: { select: { token: true, revokedAt: true } } },
    })
    if (!brief) throw new NotFoundException('Deal brief not found')
    if (brief.share && !brief.share.revokedAt) return { token: brief.share.token }

    const token = randomBytes(24).toString('base64url')
    await db.briefShare.upsert({
      where: { dealBriefId: brief.id },
      create: {
        token,
        dealBriefId: brief.id,
        organizationId: brief.organizationId,
        createdById: session.user.id,
      },
      update: {
        token,
        createdById: session.user.id,
        createdAt: new Date(),
        revokedAt: null,
      },
    })
    return { token }
  }

  async revokeBriefShare(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const brief = await db.dealBrief.findFirst({
      where: { id, organizationId: membership.organizationId },
      select: { id: true },
    })
    if (!brief) throw new NotFoundException('Deal brief not found')
    const result = await db.briefShare.updateMany({
      where: { dealBriefId: brief.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { revoked: result.count > 0 }
  }

  async sharedBrief(token: string) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new NotFoundException('Shared brief not found')
    const share = await db.briefShare.findFirst({
      where: { token },
      select: {
        revokedAt: true,
        createdAt: true,
        dealBrief: {
          select: {
            id: true,
            title: true,
            status: true,
            sections: true,
            generatedAt: true,
            updatedAt: true,
            researchRun: {
              select: {
                id: true,
                goal: true,
                prospect: { select: { name: true, companyName: true } },
                offer: { select: { name: true, valueProposition: true, targetPersona: true } },
                evidence: {
                  select: {
                    id: true,
                    claim: true,
                    signalType: true,
                    confidence: true,
                    observedAt: true,
                    source: { select: { title: true, url: true, publisher: true } },
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    })
    if (!share) throw new NotFoundException('Shared brief not found')
    if (share.revokedAt) throw new GoneException('Shared brief link revoked')
    return { ...share.dealBrief, sharedAt: share.createdAt }
  }

  async notifications(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    return db.notification.findMany({
      where: { organizationId: membership.organizationId, userId: session.user.id },
      include: {
        researchRun: { select: { id: true, prospect: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async markNotificationRead(session: AuthenticatedSession, id: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const result = await db.notification.updateMany({
      where: {
        id,
        organizationId: membership.organizationId,
        userId: session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    })
    if (result.count !== 1) throw new NotFoundException('Unread notification not found')
    return { id, read: true }
  }

  async clearNotifications(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const result = await db.notification.deleteMany({
      where: {
        organizationId: membership.organizationId,
        userId: session.user.id,
      },
    })
    return { cleared: result.count }
  }

  async capabilities(session: AuthenticatedSession) {
    await this.accounts.assertActiveWorkspace(session)
    const configured = Boolean(this.config.get<string>('TAVILY_API_KEY'))
    return {
      webDiscovery: {
        provider: 'Tavily',
        status: configured ? 'configured' : 'keyless',
        searchDepth: this.config.get<string>('TAVILY_SEARCH_DEPTH') ?? 'advanced',
        maxResults: this.config.get<number>('TAVILY_MAX_RESULTS') ?? 6,
      },
      stages: [
        { id: 'intake', label: 'Prospect and offer intake', status: 'ready' },
        { id: 'source-discovery', label: 'Public source discovery', status: 'ready' },
        { id: 'evidence-normalization', label: 'Evidence normalization', status: 'ready' },
        { id: 'brief-synthesis', label: 'Conversation brief synthesis', status: 'ready' },
        { id: 'notification-delivery', label: 'Completion notifications', status: 'ready' },
      ],
    }
  }
}
