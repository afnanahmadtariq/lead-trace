const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const enabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

test('research runs snapshot submitted contact data and recover interrupted discovery', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  const { db } = require('@lead-trace/db')
  const { AccountContextService } = require('../dist/auth/account-context.service.js')
  const { ResearchRunsService } = require('../dist/research/research-runs.service.js')
  const id = randomUUID(), org = `rr-${id}`, user = `rr-user-${id}`
  const session = { user: { id: user, name: 'Research Tester' }, session: { id, activeOrganizationId: org } }
  const research = new ResearchRunsService(new AccountContextService())
  const base = { offerName: 'Lead Trace', offerContext: 'Research with evidence.', goal: 'meeting' }
  try {
    await db.user.create({ data: { id: user, email: `${user}@example.test`, name: 'Tester' } })
    await db.organization.create({ data: { id: org, name: org, slug: org, createdAt: new Date() } })
    await db.member.create({ data: { id: randomUUID(), organizationId: org, userId: user, role: 'owner', createdAt: new Date() } })

    // Email match: the run researches the submitted company, the CRM contact is linked but not overwritten.
    const contact = await db.prospect.create({ data: { organizationId: org, name: 'Maya Chen', email: 'maya@example.com', emailKey: 'maya@example.com', companyName: 'Old Co', companyDomain: 'old.example.com' } })
    const fresh = await research.create(session, { ...base, prospectName: 'Maya Chen', prospectEmail: 'Maya@Example.com', companyName: 'New Co', companyDomain: 'new.example.com' })
    assert.equal(fresh.prospectId, contact.id)
    assert.equal(fresh.inputSnapshot.prospect.companyName, 'New Co'); assert.equal(fresh.inputSnapshot.prospect.companyDomain, 'new.example.com')
    const partial = await research.create(session, { ...base, prospectName: 'Maya Chen', prospectEmail: 'maya@example.com', companyName: 'Newer Co' })
    assert.equal(partial.inputSnapshot.prospect.companyName, 'Newer Co'); assert.equal(partial.inputSnapshot.prospect.companyDomain, 'old.example.com')
    const stored = await db.prospect.findUnique({ where: { id: contact.id } })
    assert.equal(stored.companyName, 'Old Co'); assert.equal(stored.companyDomain, 'old.example.com')
    assert.equal(await db.prospect.count({ where: { organizationId: org } }), 1)
    // Discovery searches the submitted company, not the stored contact's older one.
    const { ResearchDiscoveryService } = require('../dist/research/research-discovery.service.js')
    const queries = []
    const tavily = { search: async (query) => { queries.push(query.query); return { kind: query.kind, query: query.query, requestId: 'r', responseTimeMs: 0, credits: null, sources: [] } } }
    await new ResearchDiscoveryService(new AccountContextService(), tavily, { discover: async () => [] }).discover(session, fresh.id).catch(() => undefined)
    assert.ok(queries.some((query) => query.includes('New Co')))
    assert.ok(!queries.some((query) => query.includes('Old Co')))
    // Identity anchor is checked on the merged values.
    await db.prospect.create({ data: { organizationId: org, name: 'No Anchor', email: 'none@example.com', emailKey: 'none@example.com' } })
    await assert.rejects(() => research.create(session, { ...base, prospectName: 'No Anchor', prospectEmail: 'none@example.com' }), /identity anchor/)

    // A run left running with no sources after the API died during discovery becomes retryable.
    const stuck = await research.create(session, { ...base, prospectName: 'Maya Chen', prospectEmail: 'maya@example.com' })
    const recent = await research.create(session, { ...base, prospectName: 'Maya Chen', prospectEmail: 'maya@example.com' })
    const withSources = await research.create(session, { ...base, prospectName: 'Maya Chen', prospectEmail: 'maya@example.com' })
    const old = new Date(Date.now() - 11 * 60000)
    await db.researchRun.updateMany({ where: { id: { in: [stuck.id, withSources.id] } }, data: { status: 'running', startedAt: old } })
    await db.researchRun.update({ where: { id: recent.id }, data: { status: 'running', startedAt: new Date() } })
    await db.evidenceSource.create({ data: { organizationId: org, researchRunId: withSources.id, url: 'https://example.com/a', title: 'A', sourceType: 'tavily-search' } })
    const detail = await research.get(session, stuck.id)
    assert.equal(detail.status, 'failed'); assert.equal(detail.errorMessage, 'Source discovery was interrupted. Retry this research.')
    const listed = await research.list(session)
    assert.equal(listed.find((run) => run.id === recent.id).status, 'running')
    assert.equal(listed.find((run) => run.id === withSources.id).status, 'running')
    assert.equal((await research.retry(session, stuck.id)).status, 'queued')
  } finally {
    await db.organization.deleteMany({ where: { id: org } })
    await db.user.deleteMany({ where: { id: user } })
    await db.$disconnect()
  }
})
