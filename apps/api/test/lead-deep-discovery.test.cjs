const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateExtractedLeads, roleMatches } = require('../dist/leads/lead-discovery.js')
const { validateCompanyPlan, companyDomain, currentRoleCompanies } = require('../dist/leads/lead-company-planner.service.js')
const { LeadDeepDiscoveryService, deepLeadQueries, companyPeopleQueries } = require('../dist/leads/lead-deep-discovery.service.js')
const { LeadRegistriesService, sameRegisteredCompany, countryCode } = require('../dist/leads/lead-registries.service.js')
const criteria = { industry: 'B2B SaaS', role: 'Head of Sales', location: 'United States', roleMatch: 'function' }
const quote = 'Maya Chen is VP of Sales at Northstar, a B2B SaaS company headquartered in the United States.'
const source = { id: 's1', url: 'https://northstar.example.com/team', title: 'Northstar leadership', publisher: 'northstar.example.com', excerpt: quote, queries: [] }
const person = { sourceId: 's1', name: 'Maya Chen', companyName: 'Northstar', jobTitle: 'VP of Sales', quote }

test('equivalent senior roles are explicit and do not include sales support or junior jobs', () => {
  assert.equal(roleMatches('VP of Sales', 'Head of Sales', 'function'), true)
  assert.equal(roleMatches('Chief Revenue Officer', 'Head of Sales', 'function'), true)
  assert.equal(roleMatches('CRO', 'Head of Sales', 'function'), true)
  assert.equal(roleMatches('VP of Sales', 'Head of Sales', 'exact'), false)
  assert.equal(roleMatches('Head of Sales Operations', 'Chief Revenue Officer', 'function'), false)
  assert.equal(roleMatches('Head of Sales Operations', 'Head of Sales', 'exact'), false)
  assert.equal(roleMatches('Head of Sales Enablement', 'Head of Sales', 'function'), false)
  assert.equal(roleMatches('Sales Development Representative', 'Head of Sales', 'function'), false)
  const result = validateExtractedLeads({ candidates: [person] }, [source], criteria)
  assert.deepEqual(result.candidates[0].missingCriteria, [])
  assert.equal(result.candidates[0].qualification.relatedRole, true)
})

test('company plans require real quotes and sourced official domains', () => {
  const company = { sourceId: 's1', name: 'Northstar', domain: 'northstar.example.com', quote }
  assert.equal(validateCompanyPlan({ companies: [company] }, [source]).length, 1)
  assert.equal(validateCompanyPlan({ companies: [{ ...company, name: 'Invented Company' }, { ...company, quote: 'A fabricated company quote that was never present.' }] }, [source]).length, 0)
  assert.equal(companyDomain('127.0.0.1', 'Northstar', [source]), null)
  assert.equal(companyDomain('linkedin.com', 'Northstar', [source]), null)
  assert.equal(companyDomain('guessed.example.com', 'Northstar', [source]), null)
  assert.equal(companyDomain('leadiq.com', 'Northstar', [{ ...source, url: 'https://leadiq.com/c/northstar', excerpt: `${quote}\nWebsite: leadiq.com` }]), null)
})

test('current employers seed company research when model planning misses them', () => {
  const profile = { ...source, url: 'https://www.linkedin.com/in/maya-chen', excerpt: 'Current role: VP of Sales\n## Experience\n- VP of Sales at Northstar (Apr 2026 to present)\n- VP of Sales at Previous Employer (Jan 2021 to Apr 2026)\n- Sales Assistant at Other (May 2026 to present)' }
  const companies = currentRoleCompanies([profile], criteria)
  assert.deepEqual(companies.map((company) => company.name), ['Northstar'])
  assert.ok(profile.excerpt.includes(companies[0].quote))
})

test('old announcement dates in the body cannot masquerade as undated current roles', () => {
  const announcement = { ...source, excerpt: `February 22, 2023 — ${quote}` }
  const result = validateExtractedLeads({ candidates: [{ ...person, quote: announcement.excerpt }] }, [announcement], criteria)
  assert.ok(result.candidates[0].qualification.issues.includes('Role needs a current source'))
  const ongoing = { ...source, excerpt: `${quote}\nExperience: VP of Sales at Northstar (Oct 2024 to present)` }
  assert.deepEqual(validateExtractedLeads({ candidates: [person] }, [ongoing], criteria).candidates[0].qualification.issues, [])
})

test('registry matching is strict about company identity and avoids parent/subsidiary collisions', () => {
  assert.equal(sameRegisteredCompany('Northstar, Inc.', 'Northstar'), true)
  assert.equal(sameRegisteredCompany('Northstar UK Ltd', 'Northstar'), false)
  assert.equal(sameRegisteredCompany('Northstar Logistics', 'Northstar Software'), false)
  assert.equal(countryCode('United States'), 'US')
  assert.equal(countryCode('London'), 'GB')
  assert.equal(countryCode('Dubai'), 'AE')
})

test('registries cannot manufacture employment, industry, or a buyer’s work location', () => {
  assert.equal(validateExtractedLeads({ candidates: [person] }, [{ ...source, sourceKind: 'registry' }], criteria).candidates.length, 0)
  const other = { ...source, id: 'registry', sourceKind: 'registry', title: 'Northstar', excerpt: 'Northstar registered address: United States. SaaS software company.' }
  const result = validateExtractedLeads({ candidates: [{ ...person, quote: 'Maya Chen is VP of Sales at Northstar.', evidence: { location: { sourceId: 'registry', quote: other.excerpt }, industry: { sourceId: 'registry', quote: other.excerpt } } }] }, [{ ...source, excerpt: 'Maya Chen is VP of Sales at Northstar.' }, other], criteria)
  assert.deepEqual(result.candidates[0].missingCriteria, ['industry', 'location'])
})

test('deep discovery performs company-specific searches and page reads, retaining partial provider failures', async () => {
  const calls = [], registry = { provider: 'GLEIF', id: '52990000000000000000', name: 'Northstar', url: 'https://api.gleif.org/api/v1/lei-records/52990000000000000000', status: 'ACTIVE', city: 'Austin', country: 'United States', scope: 'Reported headquarters' }
  const tavily = {
    search: async (input) => { calls.push(input); return { query: input.query, kind: input.kind, requestId: 'request', responseTimeMs: 1, credits: 2, sources: [{ ...source, score: 0.9, publishedAt: null }] } },
    extractPages: async () => ({ sources: [{ ...source, score: 1, publishedAt: null }], credits: 1, failed: 0 }),
    crawlCompany: async () => { throw new Error('Site refused extraction') },
  }
  const registries = { seed: async () => ({ sources: [], activity: [] }), enrich: async () => ({ records: [registry], activity: [] }), source: (record, id) => ({ ...source, id, url: record.url, title: 'GLEIF: Northstar', excerpt: 'Company: Northstar. Reported headquarters: Austin, United States.', sourceKind: 'registry', provider: 'gleif' }) }
  const planner = { plan: async (sources) => [{ name: 'Northstar', domain: 'northstar.example.com', sourceId: sources[0].id, quote, registries: [] }] }
  const extraction = { extract: async (sources) => validateExtractedLeads({ candidates: [{ ...person, sourceId: sources.find((entry) => entry.url === source.url).id }] }, sources, criteria) }
  const phases = []
  const result = await new LeadDeepDiscoveryService(tavily, extraction, registries, planner).run(criteria, 'deep', 'search', async (progress) => phases.push(progress.phase))
  assert.equal(calls.length, 9)
  assert.ok(calls.some((call) => call.kind === 'company-people' && call.query.includes('Northstar')))
  assert.equal(result.companies[0].registries[0].id, registry.id)
  assert.equal(result.candidates.length, 1)
  assert.ok(result.activity.some((entry) => entry.operation === 'company-site crawl' && entry.status === 'unavailable'))
  assert.ok(result.sources.some((entry) => entry.sourceKind === 'registry'))
  assert.deepEqual(phases, ['discovering', 'companies', 'people', 'reading', 'extracting'])
})

test('a total web outage is a failure rather than a misleading zero-buyer result', async () => {
  const tavily = { search: async () => { throw new Error('Outage') } }
  const registries = { seed: async () => ({ sources: [source], activity: [] }) }
  await assert.rejects(() => new LeadDeepDiscoveryService(tavily, {}, registries, {}).run(criteria, 'deep', 'search', async () => {}), /Registry records alone cannot establish current buyers/)
})

test('registry searches exclude funds and retain only exact professional company fields', async () => {
  const original = global.fetch
  const record = (name, category = 'GENERAL') => ({ id: '52990000000000000000', attributes: { entity: { legalName: { name }, category, status: 'ACTIVE', headquartersAddress: { city: 'Austin', country: 'US' } } } })
  try {
    global.fetch = async (url, options) => {
      assert.match(url, /^https:\/\/api\.gleif\.org\/api\/v1\/lei-records/)
      assert.equal(options.redirect, 'error')
      return Response.json({ data: [record('Northstar Inc.'), record('Software Growth ETF', 'FUND')] })
    }
    const result = await new LeadRegistriesService().seed(criteria)
    assert.equal(result.sources.length, 1)
    assert.match(result.sources[0].excerpt, /Reported headquarters: Austin, United States/)
    assert.equal(result.activity[0].status, 'ok')
    global.fetch = async () => { throw new Error('Unavailable') }
    assert.equal((await new LeadRegistriesService().seed(criteria)).activity[0].status, 'unavailable')
  } finally { global.fetch = original }
})

test('deep queries remain bounded and direct company searches keep the company anchor', () => {
  assert.equal(deepLeadQueries(criteria).length, 6)
  assert.ok(deepLeadQueries({ ...criteria, role: 'x'.repeat(500) }).every((query) => query.query.length <= 400))
  assert.equal(companyPeopleQueries({ name: 'Northstar', domain: null }, criteria).length, 3)
})

test('company planning satisfies the model JSON-mode contract', async () => {
  const { LeadCompanyPlanner } = require('../dist/leads/lead-company-planner.service.js')
  const original = global.fetch
  try {
    global.fetch = async (_url, request) => {
      const body = JSON.parse(request.body)
      assert.equal(body.response_format.type, 'json_object')
      assert.ok(body.messages.some((message) => /json/i.test(message.content)), 'JSON mode requires the word JSON in the prompt')
      return Response.json({ choices: [{ message: { content: JSON.stringify({ companies: [{ name: 'Northstar', domain: 'northstar.example.com', sourceId: 's1', quote }] }) } }] })
    }
    const result = await new LeadCompanyPlanner({ get: (key) => key === 'DASHSCOPE_API_KEY' ? 'test-key' : undefined }).plan([source], criteria)
    assert.equal(result[0].name, 'Northstar')
  } finally { global.fetch = original }
})

test('SaaS expertise in an author biography and SaaS customers cannot prove company industry', () => {
  for (const industryQuote of ['Jane brings B2B SaaS marketing expertise to her writing.', 'Northstar provides tax services for SaaS businesses.']) {
    const other = { ...source, id: 'about', excerpt: `Northstar. ${industryQuote}`, url: 'https://northstar.example.com/about' }
    const result = validateExtractedLeads({ candidates: [{ ...person, quote: 'Maya Chen is VP of Sales at Northstar.', evidence: { industry: { sourceId: 'about', quote: industryQuote } } }] }, [{ ...source, excerpt: 'Maya Chen is VP of Sales at Northstar.' }, other], criteria)
    assert.ok(result.candidates[0].missingCriteria.includes('industry'))
  }
})
