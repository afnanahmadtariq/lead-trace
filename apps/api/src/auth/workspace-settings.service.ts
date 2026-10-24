import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { db } from '@lead-trace/db'
import type { AuthenticatedSession } from './account-context.service'
import { AccountContextService } from './account-context.service'

function isWorkspaceAdmin(role: string) {
  return role === 'owner' || role === 'admin'
}

@Injectable()
export class WorkspaceSettingsService {
  constructor(private readonly accounts: AccountContextService) {}

  async getSettings(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    const admin = isWorkspaceAdmin(membership.role)
    const [members, invitations] = await Promise.all([
      db.member.findMany({
        where: { organizationId: membership.organizationId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      admin
        ? db.invitation.findMany({
          where: { organizationId: membership.organizationId, status: 'pending', expiresAt: { gt: new Date() } },
          select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
        : Promise.resolve([]),
    ])

    return {
      currentUserId: session.user.id,
      workspace: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
        isAdmin: admin,
      },
      members: members.map((item) => ({
        id: item.id,
        role: item.role,
        joinedAt: item.createdAt,
        user: item.user,
      })),
      invitations,
    }
  }

  async updateWorkspace(session: AuthenticatedSession, name?: unknown) {
    const membership = await this.assertAdmin(session)
    const nextName = typeof name === 'string' ? name.trim() : ''
    if (nextName.length < 2 || nextName.length > 80) {
      throw new BadRequestException('Workspace name must be between 2 and 80 characters')
    }
    const workspace = await db.organization.update({
      where: { id: membership.organizationId },
      data: { name: nextName },
      select: { id: true, name: true, slug: true },
    })
    return { workspace }
  }

  async deleteWorkspaceBriefs(session: AuthenticatedSession, confirmation?: string) {
    const membership = await this.assertAdmin(session)
    if (confirmation !== 'DELETE BRIEFS') {
      throw new BadRequestException('Type DELETE BRIEFS to confirm deleting every Deal Brief in this workspace')
    }
    const deleted = await db.dealBrief.deleteMany({ where: { organizationId: membership.organizationId } })
    return { deletedBriefs: deleted.count }
  }

  async wipeWorkspaceResearchData(session: AuthenticatedSession, confirmation?: string) {
    const membership = await this.assertAdmin(session)
    if (confirmation !== membership.organization.name) {
      throw new BadRequestException('Type the workspace name to confirm wiping this workspace research data')
    }
    const organizationId = membership.organizationId
    const deleted = await db.$transaction(async (tx) => {
      const notifications = await tx.notification.deleteMany({ where: { organizationId } })
      const briefs = await tx.dealBrief.deleteMany({ where: { organizationId } })
      const evidence = await tx.evidence.deleteMany({ where: { organizationId } })
      const sources = await tx.evidenceSource.deleteMany({ where: { organizationId } })
      const runs = await tx.researchRun.deleteMany({ where: { organizationId } })
      // Searches cascade to their scraped sources and candidates; converted CRM contacts are untouched.
      const leadSearches = await tx.leadSearch.deleteMany({ where: { organizationId } })
      // Contacts are CRM records now; a research wipe must preserve relationships.
      const offers = await tx.offer.deleteMany({ where: { organizationId } })
      return {
        notifications: notifications.count,
        briefs: briefs.count,
        evidence: evidence.count,
        sources: sources.count,
        runs: runs.count,
        leadSearches: leadSearches.count,
        prospects: 0,
        offers: offers.count,
      }
    })
    return { deleted }
  }

  async deleteWorkspace(session: AuthenticatedSession, confirmation?: string) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    // Better Auth can store several roles comma-separated.
    if (!membership.role.split(',').includes('owner')) {
      throw new ForbiddenException('Only the workspace owner can delete this workspace')
    }
    if (confirmation !== membership.organization.name) {
      throw new BadRequestException('Type the workspace name to confirm deleting this workspace')
    }
    await db.organization.delete({ where: { id: membership.organizationId } })
    return { deleted: true }
  }

  private async assertAdmin(session: AuthenticatedSession) {
    const membership = await this.accounts.assertActiveWorkspace(session)
    if (!isWorkspaceAdmin(membership.role)) {
      throw new ForbiddenException('Only workspace admins can change or delete shared workspace data')
    }
    return membership
  }
}
