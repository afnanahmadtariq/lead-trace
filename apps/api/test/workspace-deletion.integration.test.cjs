const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const enabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

async function seedResearch(db, organizationId, userId) {
  const prospect = await db.prospect.create({ data: { organizationId, name: 'Maya Chen', companyName: 'Northstar' } })
  const offer = await db.offer.create({ data: { organizationId, name: 'Offer', valueProposition: 'Value' } })
  const run = await db.researchRun.create({ data: { organizationId, createdById: userId, prospectId: prospect.id, offerId: offer.id, goal: 'Goal', inputSnapshot: {} } })
  const source = await db.evidenceSource.create({ data: { organizationId, researchRunId: run.id, url: 'https://example.com/a', title: 'A', sourceType: 'tavily-search' } })
  await db.evidence.create({ data: { organizationId, researchRunId: run.id, sourceId: source.id, claim: 'Claim', signalType: 'news', confidence: 0.9 } })
  const brief = await db.dealBrief.create({ data: { organizationId, researchRunId: run.id, title: 'Brief', sections: [] } })
  await db.briefShare.create({ data: { organizationId, dealBriefId: brief.id, token: randomUUID(), createdById: userId } })
  return run
}

test('deleting a workspace cascades through research data without pre-deletes, including the account deletion path', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { getAccountDeletionPolicy } = require('../dist/auth/account-deletion.policy.js')
  const id = randomUUID(), orgA = `del-a-${id}`, orgB = `del-b-${id}`, user = `del-user-${id}`
  try {
    await db.user.create({ data: { id: user, email: `${user}@example.test`, name: 'Deleter' } })
    await db.organization.createMany({ data: [orgA, orgB].map((oid) => ({ id: oid, name: oid, slug: oid, createdAt: new Date() })) })
    await db.member.createMany({ data: [orgA, orgB].map((organizationId) => ({ id: randomUUID(), organizationId, userId: user, role: 'owner', createdAt: new Date() })) })
    const runA = await seedResearch(db, orgA, user), runB = await seedResearch(db, orgB, user)
    await db.organization.delete({ where: { id: orgA } })
    assert.equal(await db.researchRun.count({ where: { id: runA.id } }), 0)
    assert.equal(await db.evidence.count({ where: { organizationId: orgA } }), 0)
    assert.equal(await db.offer.count({ where: { organizationId: orgA } }), 0)
    // Same transaction as auth.ts beforeDelete.
    const policy = await getAccountDeletionPolicy(user)
    assert.deepEqual(policy.soleWorkspaceIds, [orgB])
    await db.$transaction(async (tx) => { await tx.organization.deleteMany({ where: { id: { in: policy.soleWorkspaceIds } } }) })
    assert.equal(await db.researchRun.count({ where: { id: runB.id } }), 0)
    assert.equal(await db.evidenceSource.count({ where: { organizationId: orgB } }), 0)
    assert.equal(await db.briefShare.count({ where: { organizationId: orgB } }), 0)
  } finally {
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    await db.user.deleteMany({ where: { id: user } })
    await db.$disconnect()
  }
})

test('account deletion policy handles sole, shared-admin and only-admin workspaces', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { getAccountDeletionPolicy } = require('../dist/auth/account-deletion.policy.js')
  const id = randomUUID(), sole = `pol-sole-${id}`, withAdmin = `pol-admin-${id}`, onlyAdmin = `pol-only-${id}`
  const deleting = `pol-del-${id}`, otherAdmin = `pol-oa-${id}`, older = `pol-older-${id}`, newer = `pol-newer-${id}`
  const orgs = [sole, withAdmin, onlyAdmin], users = [deleting, otherAdmin, older, newer]
  const memberIds = { older: randomUUID(), newer: randomUUID(), admin: randomUUID() }
  const at = (days) => new Date(Date.UTC(2026, 0, days))
  try {
    await db.user.createMany({ data: users.map((uid) => ({ id: uid, email: `${uid}@example.test`, name: uid })) })
    await db.organization.createMany({ data: orgs.map((oid) => ({ id: oid, name: oid, slug: oid, createdAt: new Date() })) })
    const member = (organizationId, userId, role, createdAt, memberId = randomUUID()) => ({ id: memberId, organizationId, userId, role, createdAt })
    await db.member.createMany({ data: [
      member(sole, deleting, 'owner', at(1)),
      member(withAdmin, deleting, 'owner', at(1)), member(withAdmin, older, 'member', at(2)), member(withAdmin, otherAdmin, 'admin', at(3), memberIds.admin),
      member(onlyAdmin, deleting, 'owner', at(1)), member(onlyAdmin, newer, 'member', at(4), memberIds.newer), member(onlyAdmin, older, 'member', at(2), memberIds.older),
    ] })
    const policy = await getAccountDeletionPolicy(deleting)
    assert.deepEqual(policy.soleWorkspaceIds, [sole])
    assert.deepEqual(policy.soleWorkspaceNames, [sole])
    // Last owner leaving a workspace with an admin: the admin becomes owner and inherits invitations.
    assert.deepEqual(policy.successorPromotions.find((promotion) => promotion.organizationId === withAdmin), { memberId: memberIds.admin, organizationId: withAdmin, role: 'owner' })
    assert.equal(policy.sharedWorkspaceSuccessors.find((successor) => successor.organizationId === withAdmin).userId, otherAdmin)
    // Last owner with no admin: the oldest remaining member becomes owner and receives invitations.
    assert.deepEqual(policy.successorPromotions.find((promotion) => promotion.organizationId === onlyAdmin), { memberId: memberIds.older, organizationId: onlyAdmin, role: 'owner' })
    assert.equal(policy.successorPromotions.length, 2)
    assert.equal(policy.sharedWorkspaceSuccessors.find((successor) => successor.organizationId === onlyAdmin).userId, older)
    assert.ok(!policy.sharedWorkspaceSuccessors.some((successor) => successor.organizationId === sole))
  } finally {
    await db.organization.deleteMany({ where: { id: { in: orgs } } })
    await db.user.deleteMany({ where: { id: { in: users } } })
    await db.$disconnect()
  }
})
