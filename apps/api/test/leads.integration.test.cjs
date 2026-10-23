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
  const input = { depth: 'quick', roleMatch: 'exact', title: 'London SaaS sales leaders', industry: 'SaaS', role: 'Head of Sales', location: 'London' }
  try {
    await db.user.createMany({ data: [{ id: userA, email: `a-${id}@leads.test`, name: 'A' }, { id: userB, email: `b-${id}@leads.test`, name: 'B' }] })
    await db.organization.createMany({ data: [{ id: orgA, name: 'A', slug: orgA, createdAt: new Date() }, { id: orgB, name: 'B', slug: orgB, createdAt: new Date() }] })
    await db.member.createMany({ data: [{ id: randomUUID(), organizationId: orgA, userId: userA, role: 'owner', createdAt: new Date() }, { id: randomUUID(), organizationId: orgB, userId: userB, role: 'owner', createdAt: new Date() }] })
    global.fetch = async (url, request) => {
      assert.ok(url.endsWith('/chat/completions'))
      const body = JSON.parse(request.body)
      assert.equal(body.response_format.type, 'json_object')
      const data = JSON.parse(body.messages.at(-1).content)
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
    assert.deepEqual(candidate.missingCriteria, [])
    assert.equal(candidate.qualification.version, 2)
    assert.equal(candidate.qualification.evidence.location.sourceId, result.sources[0].id)
    assert.equal(candidate.qualification.evidence.role.quote, candidate.quote)
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
    assert.deepEqual((await crm.detail(a, converted.prospectId)).leadCandidates[0].qualification, candidate.qualification)
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
    const concurrentSearches = await Promise.allSettled(Array.from({ length: 4 }, () => leads.create(a, input)))
    assert.equal(concurrentSearches.filter((result) => result.status === 'fulfilled').length, 3)
    assert.equal(concurrentSearches.filter((result) => result.status === 'rejected').length, 1)
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    assert.equal(await db.leadCandidate.count({ where: { searchId: search.id } }), 0)
  } finally {
    global.fetch = originalFetch
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } })
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } })
    await db.$disconnect()
  }
})

test('background deep discovery persists progress, registry provenance, recovery and cancellation', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { AccountContextService } = require('../dist/auth/account-context.service.js')
  const { CrmService } = require('../dist/crm/crm.service.js')
  const { LeadsService } = require('../dist/leads/leads.service.js')
  const { validateExtractedLeads } = require('../dist/leads/lead-discovery.js')
  const id = randomUUID(), org = `deep-jobs-${id}`, user = `deep-user-${id}`
  const session = { user: { id: user }, session: { id, activeOrganizationId: org } }
  const config = { get: () => 'test-key' }
  let release, pause, fail = false
  const sources = [
    { id: 'team', url: 'https://northstar.example.com/team', title: 'Northstar team', excerpt: 'Maya Chen is Head of Sales at Northstar, a B2B SaaS company in London.', publisher: 'northstar.example.com', queries: [], provider: 'tavily', sourceKind: 'company_crawl' },
    { id: 'registry', url: 'https://www.wikidata.org/wiki/Q123', title: 'Northstar registry', excerpt: 'Company: Northstar. Registry identifier: Q123. Website corroborated.', publisher: 'www.wikidata.org', queries: [], provider: 'wikidata', sourceKind: 'registry' },
  ]
  const discovery = { run: async (criteria, depth, searchId, progress) => {
    assert.equal(depth, 'deep'); assert.equal(criteria.roleMatch, 'function')
    await progress({ phase: 'reading', message: 'Reading company pages', sources: 2, companies: 1, queries: 9 })
    if (pause) await pause
    if (fail) throw new Error('Simulated worker interruption')
    await progress({ phase: 'extracting', message: 'Checking people', sources: 2, companies: 1, queries: 9 })
    return { ...validateExtractedLeads({ candidates: [{ sourceId: 'team', name: 'Maya Chen', companyName: 'Northstar', jobTitle: 'Head of Sales', quote: sources[0].excerpt }] }, sources, criteria), sources, companies: [{ name: 'Northstar', sourceId: 'team', quote: sources[0].excerpt, domain: 'northstar.example.com', registries: [{ provider: 'Wikidata', id: 'Q123' }] }], activity: [{ provider: 'Tavily', operation: 'company-site crawl', requests: 1, records: 1, credits: 1, status: 'ok' }], queries: [{ kind: 'company-team', query: 'Northstar team' }], failedQueries: 0 }
  } }
  const leads = new LeadsService(new CrmService(new AccountContextService()), {}, { configured: () => true }, config, discovery)
  const input = { title: 'Deep background fixture', industry: 'B2B SaaS', role: 'Head of Sales', location: 'London' }
  try {
    await db.user.create({ data: { id: user, email: `${user}@example.test`, name: 'Deep Tester' } })
    await db.organization.create({ data: { id: org, name: org, slug: org, createdAt: new Date() } })
    await db.member.create({ data: { id: randomUUID(), organizationId: org, userId: user, role: 'owner', createdAt: new Date() } })
    const queued = await leads.create(session, input)
    assert.equal(queued.depth, 'deep'); assert.equal(queued.roleMatch, 'function')
    assert.equal((await leads.requestDiscovery(session, queued.id)).status, 'queued')
    pause = new Promise((resolve) => { release = resolve })
    const job = leads.processNext()
    for (let i = 0; i < 100; i++) { if ((await leads.get(session, queued.id)).phase === 'reading') break; await new Promise((resolve) => setTimeout(resolve, 10)) }
    const running = await leads.get(session, queued.id)
    assert.equal(running.phase, 'reading'); assert.equal(running.progress.companies, 1)
    assert.equal((await leads.requestDiscovery(session, queued.id)).status, 'running')
    release(); pause = null; assert.equal(await job, true)
    const done = await leads.get(session, queued.id)
    assert.equal(done.status, 'completed'); assert.equal(done.attemptCount, 1)
    assert.equal(done.sources.find((source) => source.provider === 'wikidata').sourceKind, 'registry')
    assert.equal(done.companySnapshots[0].sourceId, done.candidates[0].sourceId)
    assert.equal(done.candidates[0].qualification.evidence.industry.sourceId, done.candidates[0].sourceId)
    assert.equal(done.diagnostics.activity[0].operation, 'company-site crawl')
    await assert.rejects(() => leads.requestDiscovery(session, queued.id), /finished/)
    const interrupted = await leads.create(session, input)
    await db.leadSearch.update({ where: { id: interrupted.id }, data: { status: 'running', attemptToken: 'old-process', lockExpiresAt: new Date(0), attemptCount: 1 } })
    assert.equal(await leads.processNext(), true)
    assert.equal((await leads.get(session, interrupted.id)).attemptCount, 2)
    // A crash on the 5th attempt must settle as failed instead of staying running forever.
    const exhausted = await leads.create(session, input)
    await db.leadSearch.update({ where: { id: exhausted.id }, data: { status: 'running', attemptToken: 'dead', lockExpiresAt: new Date(0), attemptCount: 5 } })
    await leads.processNext()
    const settled = await leads.get(session, exhausted.id)
    assert.equal(settled.status, 'failed'); assert.equal(settled.errorMessage, 'Lead generation could not finish after 5 attempts.'); assert.equal(settled.attemptToken, null); assert.equal(settled.lockExpiresAt, null); assert.equal(settled.interrupted, false)
    const cancelled = await leads.create(session, input)
    pause = new Promise((resolve) => { release = resolve })
    const cancellationJob = leads.processNext()
    for (let i = 0; i < 100; i++) { if ((await leads.get(session, cancelled.id)).phase === 'reading') break; await new Promise((resolve) => setTimeout(resolve, 10)) }
    await leads.cancel(session, cancelled.id); release(); pause = null
    await assert.rejects(() => cancellationJob, /cancelled or superseded/)
    assert.equal((await leads.get(session, cancelled.id)).sources.length, 0)
    const retry = await leads.create(session, input); fail = true
    await assert.rejects(() => leads.processNext(), /interruption/)
    assert.equal((await leads.get(session, retry.id)).status, 'failed')
    fail = false
    assert.equal((await leads.requestDiscovery(session, retry.id)).status, 'queued')
    await leads.processNext()
    assert.equal((await leads.get(session, retry.id)).status, 'completed')
  } finally {
    release?.()
    await db.organization.deleteMany({ where: { id: org } })
    await db.user.deleteMany({ where: { id: user } })
    await db.$disconnect()
  }
})
