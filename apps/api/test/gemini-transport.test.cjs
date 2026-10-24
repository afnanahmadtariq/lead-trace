const assert = require('node:assert/strict')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
const https = require('node:https')
const { geminiRequest } = require('../dist/ai/gemini-transport.js')
const { requestModelJson } = require('../dist/ai/model-provider.js')

function stub(t, { status = 200, chunks = ['{"ok":true}'], fail = false } = {}) {
  const calls = []
  t.mock.method(https, 'request', (url, options, callback) => {
    const request = new EventEmitter()
    request.destroy = (error) => request.emit('error', error)
    request.end = (body) => {
      calls.push({ url, options, body })
      queueMicrotask(() => {
        if (fail) { request.destroy(new Error('connection failed')); return }
        const response = new EventEmitter()
        response.statusCode = status
        callback(response)
        for (const chunk of chunks) response.emit('data', Buffer.from(chunk))
        response.emit('end')
      })
    }
    return request
  })
  return calls
}

test('Gemini HTTPS transport preserves authorization, body, status and abort signal', async (t) => {
  const calls = stub(t)
  const signal = AbortSignal.timeout(1000)
  const response = await geminiRequest('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { headers: { Authorization: 'Bearer test-secret' }, body: '{"model":"test"}', signal })
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-secret')
  assert.equal(calls[0].options.signal, signal)
  assert.equal(calls[0].options.headers['content-length'], String(Buffer.byteLength(calls[0].body)))
  assert.equal(calls[0].options.rejectUnauthorized, undefined)
})

test('Gemini transport connection failures and oversized responses reject cleanly', async (t) => {
  const mock = t.mock.method(https, 'request', () => { throw new Error('connection failed') })
  await assert.rejects(geminiRequest('https://example.test', { body: '{}' }), /connection failed/)
  mock.mock.restore()
  stub(t, { chunks: ['x'.repeat(1024 * 1024 + 1)] })
  await assert.rejects(geminiRequest('https://example.test', { body: '{}' }), /size limit/)
})

test('a real transport error response drives the configured DashScope fallback', async (t) => {
  stub(t, { status: 429, chunks: ['{"error":{"code":429}}'] })
  let fallbackCalls = 0
  t.mock.method(global, 'fetch', async () => { fallbackCalls++; return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }) })
  const values = { NODE_ENV: 'production', GEMINI_API_KEY: 'gemini-key', DASHSCOPE_API_KEY: 'dashscope-key' }
  const result = await requestModelJson({ get: (key) => values[key] }, { messages: [], maxTokens: 100, timeoutMs: 1000 }, (value) => value)
  assert.deepEqual(result, { ok: true })
  assert.equal(fallbackCalls, 1)
})
