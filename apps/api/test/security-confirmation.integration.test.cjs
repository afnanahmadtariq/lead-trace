const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHmac, randomUUID } = require('node:crypto')
const enabled = process.env.INTEGRATION_TESTS === 'true' && process.env.DATABASE_URL

const hash = (code) => createHmac('sha256', process.env.BETTER_AUTH_SECRET || 'lead-trace-development-secret-change-before-production').update(code).digest('hex')

async function withConfirmation(run) {
  const { db } = require('@lead-trace/db')
  const { AccountContextService } = require('../dist/auth/account-context.service.js')
  const id = randomUUID(), action = 'enable-two-factor'
  const session = { user: { id: `sec-user-${id}` }, session: { id: `sec-session-${id}` } }
  const identifier = `security-change:${session.session.id}:${action}`
  await db.verification.create({ data: { id: randomUUID(), identifier, value: hash('123456'), expiresAt: new Date(Date.now() + 600_000) } })
  try {
    await run({ db, service: new AccountContextService(), session, action, identifier })
  } finally {
    await db.verification.deleteMany({ where: { identifier: { contains: session.session.id } } })
    await db.$disconnect()
  }
}

test('five wrong security codes lock out the code even when the sixth attempt is correct', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  await withConfirmation(async ({ db, service, session, action, identifier }) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await assert.rejects(() => service.verifySecurityConfirmation(session, action, '000000'), /not valid/)
    }
    await assert.rejects(() => service.verifySecurityConfirmation(session, action, '123456'), /Too many incorrect codes/)
    assert.equal(await db.verification.count({ where: { identifier } }), 0)
    assert.equal(await db.verification.count({ where: { identifier: `security-change-approved:${session.session.id}:${action}` } }), 0)
  })
})

test('the correct security code works on the first attempt and clears failure rows', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  await withConfirmation(async ({ db, service, session, action }) => {
    await assert.rejects(() => service.verifySecurityConfirmation(session, action, '000000'), /not valid/)
    assert.deepEqual(await service.verifySecurityConfirmation(session, action, '123456'), { verified: true })
    assert.equal(await db.verification.count({ where: { identifier: `security-change-fail:${session.session.id}:${action}` } }), 0)
    assert.equal(await db.verification.count({ where: { identifier: `security-change-approved:${session.session.id}:${action}` } }), 1)
  })
})

test('ten concurrent wrong guesses still lock out the code', { skip: enabled ? false : 'Set INTEGRATION_TESTS=true with DATABASE_URL' }, async () => {
  await withConfirmation(async ({ service, session, action }) => {
    await Promise.allSettled(Array.from({ length: 10 }, () => service.verifySecurityConfirmation(session, action, '000000')))
    await assert.rejects(() => service.verifySecurityConfirmation(session, action, '123456'), /Too many incorrect codes|not valid/)
  })
})
