import { db } from '@lead-trace/db'

export interface AccountDeletionPolicy {
  soleWorkspaceIds: string[]
  soleWorkspaceNames: string[]
  successorPromotions: Array<{ memberId: string; organizationId: string; role: 'owner' | 'admin' }>
  sharedWorkspaceSuccessors: Array<{ organizationId: string; userId: string }>
}

export async function getAccountDeletionPolicy(userId: string): Promise<AccountDeletionPolicy> {
  const memberships = await db.member.findMany({
    where: { userId },
    select: { organizationId: true, role: true, organization: { select: { name: true } } },
  })
  if (!memberships.length) {
    return { soleWorkspaceIds: [], soleWorkspaceNames: [], successorPromotions: [], sharedWorkspaceSuccessors: [] }
  }

  const otherMemberships = await db.member.findMany({
    where: { organizationId: { in: memberships.map((membership) => membership.organizationId) }, userId: { not: userId } },
    select: { id: true, organizationId: true, userId: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const membersByWorkspace = new Map<string, typeof otherMemberships>()
  for (const membership of otherMemberships) {
    const members = membersByWorkspace.get(membership.organizationId) || []
    members.push(membership)
    membersByWorkspace.set(membership.organizationId, members)
  }

  const soleWorkspaces = memberships.filter((membership) => !membersByWorkspace.get(membership.organizationId)?.length)
  const sharedWorkspaceSuccessors = memberships.flatMap((membership) => {
    const otherMembers = membersByWorkspace.get(membership.organizationId) || []
    if (!otherMembers.length) return []
    const successor = otherMembers.find((member) => member.role === 'owner' || member.role === 'admin') || otherMembers[0]
    return [{ organizationId: membership.organizationId, userId: successor.userId }]
  })
  const successorPromotions = memberships.flatMap<AccountDeletionPolicy['successorPromotions'][number]>((membership) => {
    const otherMembers = membersByWorkspace.get(membership.organizationId) || []
    if (!otherMembers.length) return []
    // Only an owner can delete a workspace, so the last owner hands that role on (to an admin if there is one).
    if (membership.role === 'owner' && !otherMembers.some((otherMember) => otherMember.role === 'owner')) {
      const successor = otherMembers.find((otherMember) => otherMember.role === 'admin') || otherMembers[0]
      return [{ memberId: successor.id, organizationId: membership.organizationId, role: 'owner' }]
    }
    const deletingAnAdmin = membership.role === 'admin'
    const hasAnotherAdmin = otherMembers.some((otherMember) => otherMember.role === 'owner' || otherMember.role === 'admin')
    if (!deletingAnAdmin || hasAnotherAdmin) return []
    return [{ memberId: otherMembers[0].id, organizationId: membership.organizationId, role: 'admin' }]
  })

  return {
    soleWorkspaceIds: soleWorkspaces.map((membership) => membership.organizationId),
    soleWorkspaceNames: soleWorkspaces.map((membership) => membership.organization.name),
    successorPromotions,
    sharedWorkspaceSuccessors,
  }
}
