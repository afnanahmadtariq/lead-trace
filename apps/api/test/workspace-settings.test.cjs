require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { plainToInstance } = require('class-transformer')
const { validate } = require('class-validator')
const { UpdateWorkspaceDto } = require('../dist/auth/workspace-settings.dto.js')

test('workspace names reject malformed input without implicit string coercion', async () => {
  for (const name of [undefined, null, 123, true, {}, { invalid: true }, [], ['Acme'], '', ' ', ' A ', 'x'.repeat(81)]) {
    const dto = plainToInstance(UpdateWorkspaceDto, { name }, { enableImplicitConversion: true })
    assert.ok((await validate(dto)).length, `Invalid name accepted: ${JSON.stringify(name)}`)
  }
})

test('workspace names trim surrounding whitespace and retain the supported length range', async () => {
  for (const name of ['  Acme  ', 'AB', 'x'.repeat(80)]) {
    const dto = plainToInstance(UpdateWorkspaceDto, { name }, { enableImplicitConversion: true })
    assert.deepEqual(await validate(dto), [])
    assert.equal(dto.name, name.trim())
  }
})
