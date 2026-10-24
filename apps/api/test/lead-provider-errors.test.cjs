const assert = require('node:assert/strict')
const { test } = require('node:test')
const { LeadExtractionService } = require('../dist/leads/lead-extraction.service.js')

test('exhausted model quota produces an actionable 503 response', async (t) => {
  t.mock.method(global, 'fetch', async () => Response.json({ error: { code: 'insufficient_quota' } }, { status: 403 }))
  const service = new LeadExtractionService({ get: (key) => key === 'DASHSCOPE_API_KEY' ? 'test-key' : undefined })
  await assert.rejects(() => service.extract([], { industry: 'SaaS', role: 'Head of Sales' }), (error) => error.getStatus() === 503 && /quota is exhausted/.test(error.message))
})

test('provider access errors and transient outages remain distinct without exposing provider payloads', async (t) => {
  const service = new LeadExtractionService({ get: (key) => key === 'DASHSCOPE_API_KEY' ? 'test-key' : undefined })
  const mock = t.mock.method(global, 'fetch', async () => Response.json({ error: { message: 'private provider detail' } }, { status: 401 }))
  await assert.rejects(() => service.extract([], { industry: 'SaaS', role: 'Head of Sales' }), (error) => error.getStatus() === 503 && /rejected access/.test(error.message) && !error.message.includes('private provider detail'))
  mock.mock.mockImplementation(async () => new Response('Unavailable', { status: 502 }))
  await assert.rejects(() => service.extract([], { industry: 'SaaS', role: 'Head of Sales' }), (error) => error.getStatus() === 502)
})
