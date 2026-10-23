import { Resend } from 'resend'
import { renderAuthEmail, type AuthEmailKind } from './auth-email.template'

interface SendAuthEmailInput {
  to: string
  kind: AuthEmailKind
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  code?: string
}

export async function sendAuthEmail(input: SendAuthEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required to send authentication email')
    }
    return
  }

  const template = renderAuthEmail(input)
  const response = await new Resend(apiKey).emails.send({
    from: process.env.RESEND_FROM_EMAIL?.trim() || 'Lead Trace <onboarding@resend.dev>',
    to: input.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    ...(process.env.RESEND_REPLY_TO_EMAIL?.trim() ? { replyTo: process.env.RESEND_REPLY_TO_EMAIL.trim() } : {}),
    tags: [{ name: 'category', value: `auth-${template.tag}` }],
  })

  if (response.error) {
    throw new Error(`Resend rejected authentication email: ${response.error.name}`)
  }
}
