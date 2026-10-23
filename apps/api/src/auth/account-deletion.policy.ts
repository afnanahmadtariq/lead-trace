import { db } from '@lead-trace/db'

export interface AccountDeletionPolicy {
  soleWorkspaceIds: string[]
  soleWorkspaceNames: string[]
  successorPromotions: Array<{ memberId: string; organizationId: string }>
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
  const successorPromotions = memberships.flatMap((membership) => {
    const otherMembers = membersByWorkspace.get(membership.organizationId) || []
    const deletingAnAdmin = membership.role === 'owner' || membership.role === 'admin'
    const hasAnotherAdmin = otherMembers.some((otherMember) => otherMember.role === 'owner' || otherMember.role === 'admin')
    if (!deletingAnAdmin || !otherMembers.length || hasAnotherAdmin) return []
    return [{ memberId: otherMembers[0].id, organizationId: membership.organizationId }]
  })

  return {
    soleWorkspaceIds: soleWorkspaces.map((membership) => membership.organizationId),
    soleWorkspaceNames: soleWorkspaces.map((membership) => membership.organization.name),
    successorPromotions,
    sharedWorkspaceSuccessors,
  }
}
