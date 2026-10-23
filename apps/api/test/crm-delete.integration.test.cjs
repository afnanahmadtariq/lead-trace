const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const enabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

test('CRM deletes are workspace scoped, protect research history and owners survive member removal', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { CrmService } = require('../dist/crm/crm.service.js')
  const { AccountContextService } = require('../dist/auth/account-context.service.js')
  const { ResearchRunsService } = require('../dist/research/research-runs.service.js')
  const id = randomUUID(), orgA = `del-a-${id}`, orgB = `del-b-${id}`, userA = `del-user-a-${id}`, userB = `del-user-b-${id}`, former = `del-former-${id}`
  const now = new Date()
  const session = (userId, organizationId) => ({ user: { id: userId, name: 'Delete Tester' }, session: { id: `session-${userId}`, activeOrganizationId: organizationId } })
  const a = session(userA, orgA), b = session(userB, orgB)
  const crm = new CrmService(new AccountContextService()), research = new ResearchRunsService(new AccountContextService())
  try {
    await db.user.createMany({ data: [userA, userB, former].map((userId) => ({ id: userId, name: userId, email: `${userId}@example.test` })) })
    await db.organization.createMany({ data: [{ id: orgA, name: 'A', slug: orgA, createdAt: now }, { id: orgB, name: 'B', slug: orgB, createdAt: now }] })
    await db.member.createMany({ data: [{ organizationId: orgA, userId: userA }, { organizationId: orgA, userId: former }, { organizationId: orgB, userId: userB }].map((member) => ({ id: randomUUID(), role: 'owner', createdAt: now, ...member })) })

    // Record in workspace A; workspace B cannot delete any of it.
    const contact = await crm.saveContact(a, { name: 'Delete Me', email: 'delete-me@example.com', companyName: 'Delete Co' })
    const deal = await crm.saveDeal(a, { prospectId: contact.id, title: 'Deal', stage: 'new', value: 10, currency: 'USD' })
    const note = await crm.note(a, contact.id, 'A note')
    const task = await crm.task(a, { prospectId: contact.id, title: 'A task', dueAt: '2027-01-02T12:00:00Z' })
    await assert.rejects(() => crm.deleteContact(b, contact.id), /Contact not found/)
    await assert.rejects(() => crm.deleteDeal(b, deal.id), /Deal not found/)
    await assert.rejects(() => crm.deleteNote(b, note.id), /Note not found/)
    await assert.rejects(() => crm.deleteTask(b, task.id), /Follow-up not found/)
    assert.equal(await db.prospect.count({ where: { id: contact.id } }), 1)
    assert.equal(await db.crmDeal.count({ where: { id: deal.id } }) + await db.crmNote.count({ where: { id: note.id } }) + await db.crmTask.count({ where: { id: task.id } }), 3)

    // Single records delete on their own; a second delete is a 404.
    await crm.deleteDeal(a, deal.id); await crm.deleteNote(a, note.id); await crm.deleteTask(a, task.id)
    await assert.rejects(() => crm.deleteTask(a, task.id), /Follow-up not found/)
    assert.equal(await db.crmDeal.count({ where: { organizationId: orgA } }) + await db.crmNote.count({ where: { organizationId: orgA } }) + await db.crmTask.count({ where: { organizationId: orgA } }), 0)

    // Research history blocks contact deletion.
    const run = await research.create(a, { prospectId: contact.id, prospectName: 'Delete Me', offerName: 'Lead Trace', offerContext: 'Research with evidence.', goal: 'meeting' })
    await assert.rejects(() => crm.deleteContact(a, contact.id), /research history/)
    assert.equal(await db.researchRun.count({ where: { id: run.id } }), 1)

    // Without runs, the contact and its children go together.
    const plain = await crm.saveContact(a, { name: 'No History' })
    await crm.saveDeal(a, { prospectId: plain.id, title: 'Gone', stage: 'new', value: 1, currency: 'USD' })
    await crm.note(a, plain.id, 'Gone'); await crm.task(a, { prospectId: plain.id, title: 'Gone', dueAt: '2027-01-02T12:00:00Z' })
    await crm.deleteContact(a, plain.id)
    await assert.rejects(() => crm.detail(a, plain.id), /Contact not found/)
    assert.equal(await db.crmDeal.count({ where: { prospectId: plain.id } }) + await db.crmNote.count({ where: { prospectId: plain.id } }) + await db.crmTask.count({ where: { prospectId: plain.id } }), 0)

    // An owner who left the workspace is kept on unrelated edits, but cannot be newly assigned.
    const owned = await crm.saveContact(a, { name: 'Owned', ownerId: former })
    const ownedDeal = await crm.saveDeal(a, { prospectId: owned.id, title: 'Owned', stage: 'new', value: 1, currency: 'USD', ownerId: former })
    await db.member.deleteMany({ where: { organizationId: orgA, userId: former } })
    assert.equal((await crm.saveContact(a, { name: 'Owned Renamed', ownerId: former }, owned.id)).ownerId, former)
    await crm.saveDeal(a, { prospectId: owned.id, title: 'Owned', stage: 'won', value: 1, currency: 'USD', ownerId: former }, ownedDeal.id)
    assert.equal((await db.crmDeal.findUnique({ where: { id: ownedDeal.id } })).ownerId, former)
    await assert.rejects(() => crm.saveContact(a, { name: 'New', ownerId: former }), /owner from this workspace/)
    await assert.rejects(() => crm.saveContact(a, { name: 'Owned', ownerId: userB }, owned.id), /owner from this workspace/)
    await assert.rejects(() => crm.saveDeal(a, { prospectId: owned.id, title: 'Owned', stage: 'won', value: 1, currency: 'USD', ownerId: userB }, ownedDeal.id), /owner from this workspace/)
  } finally {
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    await db.user.deleteMany({ where: { id: { in: [userA, userB, former] } } })
    await db.$disconnect()
  }
})
