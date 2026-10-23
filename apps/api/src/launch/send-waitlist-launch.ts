import { db } from '@lead-trace/db'
import { Resend } from 'resend'
import { renderLaunchEmail } from './launch-email.template'

const campaign = 'lead-trace-launch-2026-09'
const delayBetweenEmailsMs = 600

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function launchUrl() {
  const origin = requiredEnvironment('WEB_ORIGIN').split(',')[0]?.trim()
  if (!origin) throw new Error('WEB_ORIGIN must include at least one URL')
  return new URL('/sign-up', origin).toString()
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function run() {
  const send = process.argv.slice(2).includes('--send')
  const recipients = await db.waitlistSignup.findMany({
    where: { launchEmailSentAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  })

  console.log(`Pending launch recipients: ${recipients.length}`)
  if (!send) {
    console.log('Dry run complete. Pass --send to deliver the launch email.')
    return
  }
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Launch email delivery is restricted to NODE_ENV=production')
  }

  const resend = new Resend(requiredEnvironment('RESEND_API_KEY'))
  const from = requiredEnvironment('RESEND_FROM_EMAIL')
  const actionUrl = launchUrl()
  let sent = 0
  let failed = 0

  for (const [index, recipient] of recipients.entries()) {
    try {
      const message = renderLaunchEmail({ name: recipient.name, actionUrl })
      const response = await resend.emails.send({
        from,
        to: recipient.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
        tags: [{ name: 'category', value: 'product-launch' }],
      }, { idempotencyKey: `${campaign}-${recipient.id}` })

      if (response.error) throw new Error(`${response.error.name}: ${response.error.message}`)
      await db.waitlistSignup.update({
        where: { id: recipient.id },
        data: { launchEmailSentAt: new Date(), launchEmailId: response.data.id },
      })
      sent += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'unknown error'
      console.error(`Launch email failed for recipient ${recipient.id}: ${message}`)
    }

    if (index < recipients.length - 1) await delay(delayBetweenEmailsMs)
  }

  console.log(`Launch email result: ${sent} sent, ${failed} failed`)
  if (failed > 0) throw new Error(`${failed} launch email delivery attempt(s) failed`)
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
