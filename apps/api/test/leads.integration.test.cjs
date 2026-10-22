const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const enabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

test('lead search to qualified CRM contact preserves provenance and tenant isolation', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { AccountContextService } = require('../dist/auth/account-context.service.js')
  const { CrmService } = require('../dist/crm/crm.service.js')
  const { LeadsService } = require('../dist/leads/leads.service.js')
  const { LeadExtractionService } = require('../dist/leads/lead-extraction.service.js')
  const id = randomUUID(), orgA = `leads-a-${id}`, orgB = `leads-b-${id}`, userA = `leads-user-a-${id}`, userB = `leads-user-b-${id}`
  const originalFetch = global.fetch, state = { fail: false, pause: null, pending: null, name: 'Maya Chen', company: 'Northstar' }
  const config = { get: (key) => ({ TAVILY_API_KEY: 'test-key', DASHSCOPE_API_KEY: 'test-key', DASHSCOPE_MODEL: 'qwen-test' })[key] }
  const crm = new CrmService(new AccountContextService())
  const tavily = { search: async (input) => {
    if (state.fail) throw new Error('Simulated provider outage')
    if (state.pause) await state.pause
    return { query: input.query, kind: input.kind, requestId: 'test-request', responseTimeMs: 1, credits: 1, sources: [{ url: 'https://northstar.example.com/team', title: 'Northstar leadership', publisher: 'northstar.example.com', score: 0.9, excerpt: `${state.name} is Head of Sales at ${state.company}, a SaaS company in London.`, publishedAt: null }] }
  } }
  const leads = new LeadsService(crm, tavily, new LeadExtractionService(config), config)
  const session = (user, org) => ({ user: { id: user, name: 'Lead Tester' }, session: { id: `s-${user}`, activeOrganizationId: org } })
  const a = session(userA, orgA), b = session(userB, orgB)
  const input = { title: 'London SaaS sales leaders', industry: 'SaaS', role: 'Head of Sales', location: 'London' }
  try {
    await db.user.createMany({ data: [{ id: userA, email: `a-${id}@leads.test`, name: 'A' }, { id: userB, email: `b-${id}@leads.test`, name: 'B' }] })
    await db.organization.createMany({ data: [{ id: orgA, name: 'A', slug: orgA, createdAt: new Date() }, { id: orgB, name: 'B', slug: orgB, createdAt: new Date() }] })
    await db.member.createMany({ data: [{ id: randomUUID(), organizationId: orgA, userId: userA, role: 'owner', createdAt: new Date() }, { id: randomUUID(), organizationId: orgB, userId: userB, role: 'owner', createdAt: new Date() }] })
    global.fetch = async (url, request) => {
      assert.ok(url.endsWith('/chat/completions'))
      const body = JSON.parse(request.body)
      assert.equal(body.response_format.type, 'json_object')
      const data = JSON.parse(body.messages[1].content)
      assert.equal(data.sources.length, 1)
      return Response.json({ choices: [{ message: { content: JSON.stringify({ candidates: [{ sourceId: data.sources[0].id, name: state.name, companyName: state.company, jobTitle: 'Head of Sales', quote: data.sources[0].excerpt }, { sourceId: 'missing', name: 'Invented', companyName: 'Unknown', quote: 'This fabricated lead must not be accepted.' }] }) } }] })
    }
    const search = await leads.create(a, input)
    assert.equal((await leads.list(a)).total, 1); assert.equal((await leads.list(b)).total, 0)
    await assert.rejects(() => leads.get(b, search.id), /not found/)
    await assert.rejects(() => leads.discover(b, search.id), /not found/)
    await leads.discover(a, search.id)
    const result = await leads.get(a, search.id)
    assert.equal(result.status, 'completed'); assert.equal(result.candidates.length, 1); assert.equal(result.sources.length, 1); assert.equal(result.rejectedCandidates, 1)
    const candidate = result.candidates[0]
    assert.equal(candidate.source.url, 'https://northstar.example.com/team')
    await assert.rejects(() => leads.discover(a, search.id), /already running/)
    const details = { name: candidate.name, companyName: candidate.companyName, email: 'maya@example.com', lifecycle: 'qualified' }
    await assert.rejects(() => leads.convert(a, candidate.id, details), /Qualify/)
    await assert.rejects(() => leads.review(b, candidate.id, 'qualified'), /not found/)
    await leads.review(a, candidate.id, 'qualified')
    const converted = await leads.convert(a, candidate.id, details)
    assert.ok(converted.prospectId); assert.equal(converted.reused, false)
    const repeated = await leads.convert(a, candidate.id, details)
    assert.equal(repeated.prospectId, converted.prospectId)
    assert.equal((await crm.list(a)).total, 1)
    await assert.rejects(() => leads.review(a, candidate.id, 'dismissed'), /already been saved/)
    // Repeated discoveries of the same person reuse the CRM identity, including concurrent promotions.
    state.name = 'Alex River'; state.company = 'Southstar'
    const second = await leads.create(a, input), third = await leads.create(a, input)
    await leads.discover(a, second.id); await leads.discover(a, third.id)
    const secondLead = (await leads.get(a, second.id)).candidates[0], thirdLead = (await leads.get(a, third.id)).candidates[0]
    await leads.review(a, secondLead.id, 'qualified'); await leads.review(a, thirdLead.id, 'qualified')
    const nextDetails = { name: state.name, companyName: state.company }
    const saved = await Promise.all([leads.convert(a, secondLead.id, nextDetails), leads.convert(a, thirdLead.id, nextDetails)])
    assert.equal(saved[0].prospectId, saved[1].prospectId)
    assert.notEqual(saved[0].prospectId, converted.prospectId)
    assert.equal((await crm.list(a)).total, 2)
    const wrongSource = (await leads.get(a, third.id)).sources[0]
    await assert.rejects(() => db.leadCandidate.create({ data: { organizationId: orgB, searchId: search.id, sourceId: wrongSource.id, identityKey: 'illegal', name: 'Other', companyName: 'Other', quote: 'Illegal', matchedCriteria: [], missingCriteria: [] } }), (error) => error.code === 'P2003')
    // Provider failures are persisted and retryable; cancellation invalidates an in-flight attempt.
    state.fail = true
    const failed = await leads.create(a, input)
    await assert.rejects(() => leads.discover(a, failed.id), /unavailable/)
    assert.equal((await leads.get(a, failed.id)).status, 'failed')
    state.fail = false; await leads.discover(a, failed.id)
    const cancelled = await leads.create(a, input)
    let release
    state.pause = new Promise((resolve) => { release = resolve })
    const pending = leads.discover(a, cancelled.id)
    for (let i = 0; i < 30; i++) { if ((await leads.get(a, cancelled.id)).status === 'running') break; await new Promise((resolve) => setTimeout(resolve, 10)) }
    await leads.cancel(a, cancelled.id)
    release(); state.pause = null
    await assert.rejects(() => pending, /cancelled or superseded/)
    assert.equal((await leads.get(a, cancelled.id)).candidates.length, 0)
    assert.equal((await leads.get(a, cancelled.id)).status, 'cancelled')
    const expired = await leads.create(a, input)
    await db.leadSearch.update({ where: { id: expired.id }, data: { status: 'running', lockExpiresAt: new Date(0), attemptToken: 'dead-process' } })
    await leads.discover(a, expired.id)
    assert.equal((await leads.get(a, expired.id)).status, 'completed')
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    assert.equal(await db.leadCandidate.count({ where: { searchId: search.id } }), 0)
  } finally {
    global.fetch = originalFetch
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } })
    await db.$disconnect()
  }
})
