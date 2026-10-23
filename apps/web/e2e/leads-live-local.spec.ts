import { expect, test } from '@playwright/test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { LeadSearchDetail } from '../lib/leads'
import type { ResearchRunDetail } from '../lib/research'

test.use({ actionTimeout: 15000, navigationTimeout: 45000 })

// Opt-in release journey against an already-running app and research worker.
// Uses real paid providers and a uniquely owned, disposable local workspace.
test('running local app discovers a real buyer, saves CRM actions and completes cited research', async ({ page }) => {
  test.skip(process.env.LIVE_LOCAL_RELEASE_TEST !== 'true', 'Requires an existing local API, web app, worker and live provider keys')
  test.setTimeout(360000)
  const requireApi = createRequire(resolve(__dirname, '../../api/package.json'))
  requireApi('dotenv').config({ path: resolve(__dirname, '../../../.env') })
  const database = new URL(process.env.DATABASE_URL || '')
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname)
  const { db } = requireApi('@lead-trace/db')
  const { hashPassword } = requireApi('better-auth/crypto')
  const { createLocalAccountIssuer } = requireApi('@better-auth/core/db')
  const id = randomUUID(), organizationId = `release-${id}`, userId = `release-user-${id}`
  const workspace = `Release E2E ${id.slice(0, 8)}`, email = `release-${id}@example.test`, password = 'ReleaseLocalTest1!'
  const api = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001'
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) => console.log('Request failed:', request.url(), request.failure()?.errorText))
  try {
    const passwordHash = await hashPassword(password)
    await db.$transaction([
      db.user.create({ data: { id: userId, name: 'Release Tester', email, emailVerified: true } }),
      db.account.create({ data: { id: randomUUID(), issuer: createLocalAccountIssuer('credential'), accountId: userId, providerId: 'credential', userId, password: passwordHash } }),
      db.organization.create({ data: { id: organizationId, name: workspace, slug: organizationId, createdAt: new Date() } }),
      db.member.create({ data: { id: randomUUID(), organizationId, userId, role: 'owner', createdAt: new Date() } }),
    ])
    await page.goto('/sign-in')
    console.log('Local release journey: signing in')
    await page.getByLabel('Work email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL(/\/(?:dashboard|onboarding)(?:[/?#]|$)/)
    console.log('Local release journey: authenticated')
    if (new URL(page.url()).pathname === '/onboarding') {
      await page.getByRole('button', { name: new RegExp(workspace) }).click()
      await page.waitForURL('**/dashboard')
    }
    await page.getByRole('link', { name: 'Find leads', exact: true }).click()
    await page.getByLabel('Search name').fill('Release audit — Austin agency founders')
    await page.getByLabel('Industry or market').fill('digital marketing agency')
    await page.getByLabel('Buyer role').fill('Founder')
    await page.getByLabel('Location (optional)').fill('Austin')
    await page.getByRole('button', { name: 'Find leads', exact: true }).click()
    await page.waitForURL(/\/dashboard\/leads\/[^/]+$/)
    const searchId = new URL(page.url()).pathname.split('/').pop()
    await expect(page.getByRole('button', { name: 'Qualify lead', exact: true }).first()).toBeVisible({ timeout: 90000 })
    const result = await (await page.request.get(`${api}/leads/searches/${searchId}`)).json() as LeadSearchDetail
    const candidate = result.candidates.find((lead) => !lead.missingCriteria.length && !lead.qualification?.issues.length && lead.qualification?.version === 2 && !lead.source.url.includes('linkedin.com'))
    expect(candidate, 'Require a fully supported buyer with a company-page source').toBeTruthy()
    if (!candidate) throw new Error('No supported buyer found')
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: candidate.name, exact: true }) }).first()
    await card.getByText('Why this person matches', { exact: true }).click()
    for (const key of ['industry', 'role', 'location']) {
      const proof = candidate.qualification!.evidence[key]
      const source = result.sources.find((entry) => entry.id === proof.sourceId)
      expect(source?.excerpt.replace(/\s+/g, ' ')).toContain(proof.quote.replace(/\s+/g, ' '))
    }
    await card.getByRole('button', { name: 'Qualify lead', exact: true }).click()
    await card.getByRole('button', { name: 'Save to CRM', exact: true }).click()
    const convert = page.getByRole('dialog', { name: 'Review and save to CRM' })
    await convert.getByLabel('Company domain (optional)').fill(new URL(candidate.source.url).hostname.replace(/^www\./, ''))
    await convert.getByRole('button', { name: 'Save reviewed lead' }).click()
    await page.waitForURL(/\/dashboard\/contacts\/[^/]+$/)
    const contactUrl = page.url()
    await expect(page.getByRole('heading', { name: 'Lead discovery', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Next step' })).toBeVisible()
    await page.getByRole('button', { name: 'Add note', exact: true }).click()
    await page.getByLabel('Conversation note').fill('Release E2E: evidence reviewed; buying interest remains unconfirmed.')
    await page.getByRole('dialog').getByRole('button', { name: 'Add note', exact: true }).click()
    await page.getByRole('button', { name: 'Add follow-up', exact: true }).click()
    await page.getByLabel('Next action').fill('Review the sourced prospect before outreach')
    await page.getByLabel('Due date and time (your local time)').fill('2027-01-05T10:00')
    await page.getByRole('dialog').getByRole('button', { name: 'Add follow-up', exact: true }).click()
    await page.getByRole('button', { name: 'Add deal', exact: true }).click()
    await page.getByLabel('Deal name').fill('Release E2E prospect opportunity')
    await page.getByLabel('Value', { exact: true }).fill('1200')
    await page.getByRole('button', { name: 'Create deal', exact: true }).click()
    await page.reload()
    await expect(page.getByText('Release E2E: evidence reviewed; buying interest remains unconfirmed.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Release E2E prospect opportunity' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Next step' })).toContainText('Review the sourced prospect before outreach')
    await page.getByRole('link', { name: 'Research contact', exact: true }).click()
    await expect(page.getByLabel('Prospect name')).toHaveValue(candidate.name)
    await page.getByLabel('Offer', { exact: true }).fill('Lead Trace')
    await page.getByLabel('Problem you solve and outcome you create').fill('We help digital marketing agency founders discover relevant prospects, research public business signals, and track sales follow-ups in a built-in CRM.')
    const created = page.waitForResponse((response) => response.url() === `${api}/research-runs` && response.request().method() === 'POST')
    const submitted = page.getByRole('button', { name: 'Build meeting brief' }).click()
    const response = await created
    expect(response.ok()).toBeTruthy()
    const run = await response.json() as ResearchRunDetail
    // This fixture has no notification recipient; do not send outbound email.
    await db.researchRun.update({ where: { id: run.id }, data: { createdById: null } })
    await submitted
    await page.waitForURL(`**/dashboard/research/${run.id}`)
    let completed: ResearchRunDetail | undefined
    await expect.poll(async () => {
      completed = await (await page.request.get(`${api}/research-runs/${run.id}`)).json() as ResearchRunDetail
      return completed.status
    }, { timeout: 240000, intervals: [3000, 5000], message: 'Real research worker must finish the newly discovered buyer’s brief' }).toMatch(/completed|failed/)
    expect(completed?.status, completed?.errorMessage || 'Research must complete').toBe('completed')
    expect(completed?.sources.length).toBeGreaterThan(0)
    expect(completed?.evidence.length).toBeGreaterThan(0)
    expect(completed?.brief?.id).toBeTruthy()
    await page.goto(`/dashboard/briefs/${completed!.brief!.id}`)
    await page.getByText('Sources & confidence', { exact: true }).click()
    expect(await page.getByTestId('evidence-disclosure').locator('a[target="_blank"]').count()).toBeGreaterThan(0)
    await page.getByRole('link', { name: 'Open contact & next steps' }).click()
    await expect(page).toHaveURL(contactUrl)
    await expect(page.getByRole('link', { name: new RegExp(candidate.name) }).first()).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    expect(errors).toEqual([])
    console.log(JSON.stringify({ buyer: candidate.name, company: candidate.companyName, source: candidate.source.url, searchId, contactId: contactUrl.split('/').pop(), researchRunId: run.id, sources: completed!.sources.length, evidence: completed!.evidence.length, briefId: completed!.brief!.id, completed: true }))
  } finally {
    await db.organization.deleteMany({ where: { id: organizationId } })
    await db.user.deleteMany({ where: { id: userId } })
    await db.$disconnect()
  }
})
