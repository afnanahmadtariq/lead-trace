import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function integrationKey() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY ?? ''
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('INTEGRATION_ENCRYPTION_KEY must be 32 random bytes encoded as base64')
  return key
}
export function encrypt(value: unknown, context: string) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', integrationKey(), nonce)
  cipher.setAAD(Buffer.from(context))
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [nonce, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.')
}
export function decrypt<T>(value: string, context: string): T {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted integration data')
  const [nonce, tag, body] = parts.map((part) => Buffer.from(part, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', integrationKey(), nonce!)
  cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag!)
  return JSON.parse(Buffer.concat([cipher.update(body!), cipher.final()]).toString('utf8')) as T
}
