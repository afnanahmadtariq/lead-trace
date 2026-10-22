const assert = require('node:assert/strict')
const { randomUUID, createHash } = require('node:crypto')
const { test } = require('node:test')

const enabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

test('CRM lifecycle, tenant isolation, research reuse and Google Calendar retries', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { CrmService } = require('../dist/crm/crm.service.js')
  const { CalendarService } = require('../dist/crm/calendar.service.js')
  const { AccountContextService } = require('../dist/auth/account-context.service.js')
  const { ResearchRunsService } = require('../dist/research/research-runs.service.js')
  const { WorkspaceSettingsService } = require('../dist/auth/workspace-settings.service.js')
  const { encrypt, decrypt } = require('../dist/crm/calendar.crypto.js')
  const id = randomUUID(), orgA = `crm-a-${id}`, orgB = `crm-b-${id}`, userA = `crm-user-a-${id}`, userB = `crm-user-b-${id}`
  const now = new Date()
  const session = (userId, organizationId) => ({ user: { id: userId, name: 'CRM Tester' }, session: { id: `session-${userId}`, activeOrganizationId: organizationId } })
  const a = session(userA, orgA), b = session(userB, orgB)
  const crm = new CrmService(new AccountContextService()), calendar = new CalendarService(crm), research = new ResearchRunsService(new AccountContextService())
  const stateIds = []
  const originalFetch = global.fetch
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'calendar-test-client'
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'calendar-test-secret'
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64')
  try {
    await db.user.createMany({ data: [{ id: userA, name: 'CRM A', email: `a-${id}@crm.test` }, { id: userB, name: 'CRM B', email: `b-${id}@crm.test` }] })
    await db.organization.createMany({ data: [{ id: orgA, name: 'A', slug: orgA, createdAt: now }, { id: orgB, name: 'B', slug: orgB, createdAt: now }] })
    await db.member.createMany({ data: [{ id: randomUUID(), organizationId: orgA, userId: userA, role: 'owner', createdAt: now }, { id: randomUUID(), organizationId: orgB, userId: userB, role: 'owner', createdAt: now }] })
    assert.equal(await db.member.count({ where: { organizationId: { in: [orgA, orgB] } } }), 2)
    assert.ok(await db.member.findUnique({ where: { organizationId_userId: { organizationId: orgB, userId: userB } } }))
    const contact = await crm.saveContact(a, { name: 'Maya Chen', email: 'MAYA@example.com', companyName: 'Northstar', ownerId: userA })
    assert.equal(contact.email, 'maya@example.com')
    await assert.rejects(() => crm.saveContact(a, { name: 'Duplicate', email: 'maya@example.com' }), /already exists/)
    await assert.rejects(() => crm.detail(b, contact.id), /Contact not found/)
    await assert.rejects(() => crm.saveContact(a, { name: 'Bad owner', ownerId: userB }), /owner from this workspace/)
    await assert.rejects(() => crm.scope(session(userB, orgA)), /not available/)
    const imported = await crm.importContacts(a, 'name,email,company\nExisting,maya@example.com,Northstar\nAlex River,alex@example.com,Southstar\nAlex Duplicate,alex@example.com,Southstar')
    assert.deepEqual(imported, { created: 1, skipped: 2 })
    await assert.rejects(() => crm.importContacts(a, 'name,email\nValid,new@example.com\nX,not-an-email'), /row 3/)
    assert.equal((await crm.list(a)).total, 2)
    assert.equal((await crm.list(b)).total, 0)
    assert.equal((await crm.list(a, 'SOUTH')).items.length, 1)
    assert.ok((await crm.exportContacts(a)).csv.includes('maya@example.com'))
    assert.ok(!(await crm.exportContacts(b)).csv.includes('maya@example.com'))
    const deal = await crm.saveDeal(a, { prospectId: contact.id, title: 'Pilot', stage: 'new', value: 1200.50, currency: 'USD' })
    const body = { prospectId: contact.id, title: 'Pilot', stage: 'proposal', value: 1400, currency: 'USD', ownerId: userA }
    await crm.saveDeal(a, body, deal.id)
    assert.equal((await crm.deals(a)).items[0].stage, 'proposal')
    const other = await crm.saveContact(b, { name: 'Other' })
    await assert.rejects(() => crm.saveDeal(b, { ...body, prospectId: other.id, ownerId: userB }, deal.id), /Deal not found/)
    await assert.rejects(() => crm.note(b, contact.id, 'cross tenant'), /Contact not found/)
    await crm.note(a, contact.id, 'Discussed a pilot and next steps.')
    const task = await crm.task(a, { prospectId: contact.id, title: 'Send proposal', dueAt: '2027-01-02T12:00:00Z' })
    await assert.rejects(() => crm.completeTask(b, task.id, true), /Follow-up not found/)
    await crm.completeTask(a, task.id, true)
    assert.ok((await crm.detail(a, contact.id)).tasks[0].completedAt)
    await crm.completeTask(a, task.id, false)
    const runInput = { prospectId: contact.id, prospectName: 'Ignored stale name', offerName: 'Lead Trace', offerContext: 'Research with evidence and conversation preparation.', goal: 'meeting' }
    const run = await research.create(a, runInput)
    assert.equal(run.prospectId, contact.id)
    assert.equal(run.inputSnapshot.prospect.name, 'Maya Chen')
    await research.create(a, { ...runInput, prospectId: undefined, prospectEmail: 'MAYA@example.com' })
    assert.equal((await crm.detail(a, contact.id)).researchRuns.length, 2)
    assert.equal((await crm.list(a)).total, 2)
    await assert.rejects(() => research.create(b, { ...runInput, companyName: 'Northstar' }), /Contact not found/)
    // Database compound FK rejects a contact attached across tenants, even outside the service.
    await assert.rejects(() => db.crmTask.create({ data: { organizationId: orgB, prospectId: contact.id, title: 'Illegal', dueAt: now } }), (error) => error.code === 'P2003')

    const authorization = new URL((await calendar.connect(a)).url)
    const state = authorization.searchParams.get('state')
    stateIds.push(createHash('sha256').update(state).digest('hex'))
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
    await assert.rejects(() => calendar.callback(b, state, 'code'), /same workspace/)
    let tokenRequests = 0, eventRequests = 0, failAfterCreating = true
    const providerEvents = new Map()
    global.fetch = async (url, init) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        tokenRequests++
        assert.ok(init.body.get('code_verifier') || init.body.get('refresh_token'))
        return Response.json({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/calendar.events.owned' })
      }
      if (init.method === 'POST') {
        eventRequests++
        const event = JSON.parse(init.body)
        assert.equal(init.headers.Authorization, 'Bearer test-access-token')
        if (url.includes('sendUpdates=all')) assert.equal(event.attendees[0].email, 'maya@example.com')
        else { assert.ok(url.includes('sendUpdates=none')); assert.equal(event.attendees, undefined) }
        if (providerEvents.has(event.id)) return Response.json({}, { status: 409 })
        providerEvents.set(event.id, { id: event.id, htmlLink: 'https://www.google.com/calendar/event?eid=test' })
        if (failAfterCreating) { failAfterCreating = false; throw new Error('Lost response after Google accepted event') }
        return Response.json(providerEvents.get(event.id))
      }
      const event = providerEvents.get(url.split('/').pop())
      return Response.json(event || {}, { status: event ? 200 : 404 })
    }
    assert.ok((await calendar.callback(a, state, 'code')).includes('calendar=connected'))
    await assert.rejects(() => calendar.callback(a, state, 'code'), /expired/)
    assert.equal(tokenRequests, 1)
    const connection = await db.calendarConnection.findUnique({ where: { organizationId_userId: { organizationId: orgA, userId: userA } } })
    assert.ok(!connection.encryptedTokens.includes('test-access-token'))
    assert.equal((await calendar.status(b)).connected, false)
    await db.calendarConnection.update({ where: { id: connection.id }, data: { encryptedTokens: encrypt({ ...decrypt(connection.encryptedTokens, `${orgA}:${userA}`), expiresAt: 0 }, `${orgA}:${userA}`) } })
    const meeting = { id: randomUUID(), prospectId: contact.id, title: 'Pilot meeting', startsAt: '2027-01-01T12:00:00Z', endsAt: '2027-01-01T12:30:00Z', inviteContact: false }
    await assert.rejects(() => calendar.meeting(a, meeting), /could not be reached/)
    const saved = await calendar.meeting(a, meeting)
    assert.equal(saved.status, 'synced'); assert.equal(eventRequests, 2); assert.equal(tokenRequests, 2)
    await calendar.meeting(a, meeting); assert.equal(eventRequests, 2)
    await assert.rejects(() => calendar.meeting(a, { ...meeting, title: 'Changed request' }), /already used/)
    await assert.rejects(() => calendar.meeting(b, { ...meeting, prospectId: other.id }), /already used/)
    const invitation = await calendar.meeting(a, { ...meeting, id: randomUUID(), inviteContact: true })
    assert.equal(invitation.attendeeEmail, 'maya@example.com')
    assert.equal(eventRequests, 3)
    const cancelled = new URL((await calendar.connect(a)).url).searchParams.get('state')
    stateIds.push(createHash('sha256').update(cancelled).digest('hex'))
    assert.ok((await calendar.callback(a, cancelled, undefined, 'access_denied')).includes('calendar=cancelled'))
    const expired = new URL((await calendar.connect(a)).url).searchParams.get('state')
    const expiredId = createHash('sha256').update(expired).digest('hex'); stateIds.push(expiredId)
    await db.verification.update({ where: { id: expiredId }, data: { expiresAt: new Date(0) } })
    await assert.rejects(() => calendar.callback(a, expired, 'code'), /expired/)
    await db.calendarConnection.create({ data: { organizationId: orgB, userId: userB, encryptedTokens: encrypt({ access_token: 'test' }, `${orgB}:${userB}`) } })
    await db.member.delete({ where: { organizationId_userId: { organizationId: orgB, userId: userB } } })
    assert.equal(await db.calendarConnection.count({ where: { organizationId: orgB } }), 0)
    await calendar.disconnect(a)
    assert.equal((await calendar.status(a)).connected, false)
    assert.equal((await crm.detail(a, contact.id)).meetings.length, 2)
    const settings = new WorkspaceSettingsService(new AccountContextService())
    await settings.wipeWorkspaceResearchData(a, 'A')
    const preserved = await crm.detail(a, contact.id)
    assert.equal(preserved.researchRuns.length, 0)
    assert.equal(preserved.deals.length, 1)
    assert.equal(preserved.tasks.length, 1)
    assert.equal(preserved.notes.length, 1)
    assert.equal(preserved.meetings.length, 2)
    // Workspace deletion safely cascades all CRM records.
    await db.researchRun.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } })
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    assert.equal(await db.crmDeal.count({ where: { id: deal.id } }), 0)
    assert.equal(await db.calendarMeeting.count({ where: { id: meeting.id } }), 0)
  } finally {
    global.fetch = originalFetch
    await db.researchRun.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } })
    await db.offer.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } })
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } })
    await db.verification.deleteMany({ where: { id: { in: stateIds } } })
    await db.$disconnect()
  }
})
