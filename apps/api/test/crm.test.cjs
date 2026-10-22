const assert = require('node:assert/strict')
const { test } = require('node:test')
const { plainToInstance } = require('class-transformer')
const { validate } = require('class-validator')
const { parseContactsCsv, contactsCsv } = require('../dist/crm/csv.js')
const { decrypt, encrypt } = require('../dist/crm/calendar.crypto.js')
const { MeetingDto, CompleteTaskDto } = require('../dist/crm/crm.dto.js')
const { validateEnvironment } = require('../dist/config/env.validation.js')

test('CSV supports BOM, escaped quotes, quoted commas and multiline fields', () => {
  assert.deepEqual(parseContactsCsv('\uFEFFname,email,company\r\n"Maya ""May"" Chen",maya@example.com,"Northstar, Inc"\r\n"Alex\nRiver",,Other'), [
    { name: 'Maya "May" Chen', email: 'maya@example.com', company: 'Northstar, Inc' },
    { name: 'Alex\nRiver', email: '', company: 'Other' },
  ])
  for (const bad of ['email\na@example.com', 'name,name\nA,B', 'name,invalid\nA,B', 'name\n"Unclosed', 'name\n"A"oops', 'name,email\nA', 'name\n']) assert.throws(() => parseContactsCsv(bad))
})
test('CSV export protects spreadsheet formulas and reimports supported headers', () => {
  const csv = contactsCsv([{ name: '=HYPERLINK("malicious")', phone: '+15550001', companyName: 'Northstar, Inc', email: 'a@example.com' }])
  const [row] = parseContactsCsv(csv)
  assert.equal(row.name, '\'=HYPERLINK("malicious")')
  assert.equal(row.phone, "'+15550001")
  assert.equal(row.company, 'Northstar, Inc')
})
test('Calendar secrets authenticate tenant context and reject tampering', () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString('base64')
  const original = { access_token: 'secret', refresh_token: 'refresh-secret' }
  const value = encrypt(original, 'org-a:user-a')
  assert.ok(!value.includes('secret'))
  assert.deepEqual(decrypt(value, 'org-a:user-a'), original)
  assert.throws(() => decrypt(value, 'org-b:user-a'))
  assert.throws(() => decrypt(value.slice(1), 'org-a:user-a'))
  delete process.env.INTEGRATION_ENCRYPTION_KEY
})
test('Calendar configuration requires the full credential set and an encryption key', () => {
  assert.throws(() => validateEnvironment({ GOOGLE_CALENDAR_CLIENT_ID: 'id' }), /configured together/)
  assert.throws(() => validateEnvironment({ GOOGLE_CALENDAR_CLIENT_ID: 'id', GOOGLE_CALENDAR_CLIENT_SECRET: 'secret', INTEGRATION_ENCRYPTION_KEY: 'invalid' }), /32 random bytes/)
})
test('String booleans cannot accidentally send calendar invitations or complete tasks', async () => {
  const meeting = plainToInstance(MeetingDto, { id: '723efca6-320e-4e6b-b4fa-e551e3a8c701', prospectId: 'contact', title: 'Meeting', startsAt: '2027-01-01T12:00:00Z', endsAt: '2027-01-01T13:00:00Z', inviteContact: 'false' }, { enableImplicitConversion: true })
  assert.ok((await validate(meeting)).some((error) => error.property === 'inviteContact'))
  assert.ok((await validate(plainToInstance(CompleteTaskDto, { completed: 'false' }, { enableImplicitConversion: true }))).length)
})
