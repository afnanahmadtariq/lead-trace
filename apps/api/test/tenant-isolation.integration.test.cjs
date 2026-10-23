const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { test } = require('node:test')

const integrationEnabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

function createId() {
  return randomBytes(12).toString('hex')
}

test('research rows stay scoped to their workspace', { skip: integrationEnabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')

  const userA = createId()
  const userB = createId()
  const orgA = createId()
  const orgB = createId()
  const now = new Date()

  const runA = await db.$transaction(async (transaction) => {
    await transaction.user.createMany({
      data: [
        { id: userA, name: 'Tenant A', email: `tenant-a-${createId()}@example.com`, emailVerified: true },
        { id: userB, name: 'Tenant B', email: `tenant-b-${createId()}@example.com`, emailVerified: true },
      ],
    })
    await transaction.organization.createMany({
      data: [
        { id: orgA, name: 'Workspace A', slug: `ws-a-${createId()}`, createdAt: now },
        { id: orgB, name: 'Workspace B', slug: `ws-b-${createId()}`, createdAt: now },
      ],
    })
    await transaction.member.createMany({
      data: [
        { id: createId(), organizationId: orgA, userId: userA, role: 'owner', createdAt: now },
        { id: createId(), organizationId: orgB, userId: userB, role: 'owner', createdAt: now },
      ],
    })

    const prospectA = await transaction.prospect.create({
      data: { organizationId: orgA, createdById: userA, name: 'Prospect A', companyName: 'Company A' },
    })
    const offerA = await transaction.offer.create({
      data: { organizationId: orgA, createdById: userA, name: 'Offer A', valueProposition: 'Value A' },
    })
    return transaction.researchRun.create({
      data: {
        organizationId: orgA,
        createdById: userA,
        prospectId: prospectA.id,
        offerId: offerA.id,
        goal: 'meeting',
        status: 'queued',
        requestedAt: now,
        inputSnapshot: { goal: 'meeting' },
      },
    })
  })

  const crossTenantRead = await db.researchRun.findUnique({
    where: { id_organizationId: { id: runA.id, organizationId: orgB } },
  })
  assert.equal(crossTenantRead, null)

  const sameTenantRead = await db.researchRun.findUnique({
    where: { id_organizationId: { id: runA.id, organizationId: orgA } },
  })
  assert.ok(sameTenantRead)
  assert.equal(sameTenantRead.organizationId, orgA)

  await db.researchRun.deleteMany({ where: { id: runA.id } })
  await db.prospect.deleteMany({ where: { organizationId: orgA } })
  await db.offer.deleteMany({ where: { organizationId: orgA } })
  await db.member.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } })
  await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
  await db.user.deleteMany({ where: { id: { in: [userA, userB] } } })
})
