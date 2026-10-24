const assert = require('node:assert/strict')
const { test } = require('node:test')
const { configuredModelProviders, requestModelJson } = require('../dist/ai/model-provider.js')
const { validateEnvironment } = require('../dist/config/env.validation.js')
const { LeadExtractionService } = require('../dist/leads/lead-extraction.service.js')

const settings = (values) => ({ get: (key) => values[key] })
const production = { NODE_ENV: 'production', GEMINI_API_KEY: 'gemini-test-secret', DASHSCOPE_API_KEY: 'dashscope-test-secret' }
const result = (content = '{"ok":true}') => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
const request = (config) => requestModelJson(settings(config), { messages: [{ role: 'user', content: 'Return JSON.' }], maxTokens: 100, timeoutMs: 1000 }, (value) => value, (url, options) => fetch(url, options))

test('production prefers Gemini and omits DashScope-only request parameters', async (t) => {
  const calls = []
  t.mock.method(global, 'fetch', async (url, options) => { calls.push({ url, ...JSON.parse(options.body) }); return result() })
  assert.deepEqual(await request(production), { ok: true })
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/)
  assert.equal(calls[0].model, 'gemini-3.5-flash-lite')
  assert.equal(calls[0].reasoning_effort, 'low')
  assert.equal(calls[0].enable_thinking, undefined)
})

test('local provider order never calls Gemini even with its key present', async (t) => {
  const calls = []
  t.mock.method(global, 'fetch', async (url, options) => { calls.push({ url, ...JSON.parse(options.body) }); return result() })
  await request({ ...production, NODE_ENV: 'development', LLM_PROVIDER_ORDER: 'dashscope', DASHSCOPE_MODEL: 'qwen3.8-flash' })
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /dashscope/)
  assert.equal(calls[0].model, 'qwen3.8-flash')
  assert.equal(calls[0].enable_thinking, false)
  assert.equal(calls[0].reasoning_effort, undefined)
})

test('Gemini receives the JSON schema and grounding constraints in one system instruction', async () => {
  let sent
  await requestModelJson(settings(production), { messages: [
    { role: 'system', content: 'Return JSON {"candidates":[]} with quoted evidence.' },
    { role: 'system', content: 'Never infer roles or invent company facts.' },
    { role: 'user', content: 'Source excerpts and criteria.' },
  ], maxTokens: 100, timeoutMs: 1000 }, (value) => value, async (url, options) => { sent = JSON.parse(options.body); return result('{"candidates":[]}') })
  assert.equal(sent.messages.length, 2)
  assert.equal(sent.messages[0].role, 'system')
  assert.match(sent.messages[0].content, /Return JSON/)
  assert.match(sent.messages[0].content, /Never infer roles/)
  assert.equal(sent.messages[1].content, 'Source excerpts and criteria.')
})

test('a missing Gemini key skips it and configured Gemini alone enables extraction', async (t) => {
  t.mock.method(global, 'fetch', async (url) => { assert.match(url, /dashscope/); return result() })
  await request({ ...production, GEMINI_API_KEY: '' })
  assert.equal(new LeadExtractionService(settings({ NODE_ENV: 'production', GEMINI_API_KEY: 'key' })).configured(), true)
  assert.equal(configuredModelProviders(settings({ GEMINI_API_KEY: 'key' })).length, 0)
})

for (const kind of ['quota', 'rate-limit', 'access', 'unavailable', 'network', 'malformed-json', 'missing-content']) {
  test(`Gemini ${kind} fails over once to DashScope`, async (t) => {
    const calls = []
    t.mock.method(global, 'fetch', async (url) => {
      calls.push(url)
      if (calls.length === 2) return result()
      if (kind === 'network') throw new Error('network unavailable')
      if (kind === 'malformed-json') return result('not JSON')
      if (kind === 'missing-content') return new Response('{"choices":[]}', { status: 200 })
      return new Response(JSON.stringify({ error: { code: kind === 'quota' ? 'insufficient_quota' : kind } }), { status: { quota: 403, 'rate-limit': 429, access: 401, unavailable: 503 }[kind] })
    })
    assert.deepEqual(await request(production), { ok: true })
    assert.equal(calls.length, 2)
    assert.match(calls[0], /googleapis/)
    assert.match(calls[1], /dashscope/)
  })
}

test('a valid empty result does not trigger fallback', async (t) => {
  let count = 0
  t.mock.method(global, 'fetch', async () => { count++; return result('{"candidates":[]}') })
  assert.deepEqual(await request(production), { candidates: [] })
  assert.equal(count, 1)
})

test('all providers failing reports a sanitized error and provider order is validated', async (t) => {
  t.mock.method(global, 'fetch', async () => new Response('{"error":{"code":"insufficient_quota","message":"gemini-test-secret"}}', { status: 403 }))
  await assert.rejects(request(production), (error) => error.getStatus() === 503 && /quota/.test(error.message) && !error.message.includes('test-secret'))
  for (const order of ['gemini,unknown', 'gemini,gemini', 'gemini,']) assert.throws(() => validateEnvironment({ LLM_PROVIDER_ORDER: order }), /LLM_PROVIDER_ORDER/)
})
