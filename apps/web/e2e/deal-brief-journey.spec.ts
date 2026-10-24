import { expect, test } from '@playwright/test'
import { e2eFixtures } from './fixtures.mjs'

const apiURL = (process.env.PLAYWRIGHT_API_URL || `http://127.0.0.1:${process.env.E2E_API_PORT || 3001}`).replace(/\/+$/, '')
const webURL = `http://127.0.0.1:${process.env.E2E_WEB_PORT || 3000}`

test('clear all removes every notification from the panel', async ({ page, request }) => {
  const signIn = await request.post(`${apiURL}/api/auth/sign-in/email`, {
    data: { email: e2eFixtures.user.email, password: e2eFixtures.user.password },
  })
  expect(signIn.ok()).toBeTruthy()
  const auth = await signIn.json() as { token: string }
  const cookie = {
    name: 'lead-trace.session_token',
    value: auth.token,
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
  await page.context().addCookies([
    { ...cookie, url: webURL },
    { ...cookie, url: apiURL },
  ])

  await page.goto('/dashboard')
  await page.getByRole('button', { name: '1 unread notifications' }).click()
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all' }).click()

  await expect(page.getByText('No notifications yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: '0 unread notifications' })).toBeVisible()
})

test('sign-in, create research run, open cited brief', async ({ page, request }) => {
  const signIn = await request.post(`${apiURL}/api/auth/sign-in/email`, {
    data: { email: e2eFixtures.user.email, password: e2eFixtures.user.password },
  })
  expect(signIn.ok()).toBeTruthy()
  const auth = await signIn.json() as { token: string }
  const cookie = {
    name: 'lead-trace.session_token',
    value: auth.token,
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
  await page.context().addCookies([
    { ...cookie, url: webURL },
    { ...cookie, url: apiURL },
  ])

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog', { name: 'Workspace menu' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings & security', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/dashboard/research/new')

  await page.getByLabel('Prospect name').fill(e2eFixtures.prospect.name)
  await page.getByLabel('Company', { exact: true }).fill(e2eFixtures.prospect.companyName)
  await page.getByLabel('Offer', { exact: true }).fill(e2eFixtures.offer.name)
  await page.getByLabel('Best-fit buyer').fill(e2eFixtures.offer.persona)
  await page.getByLabel('Problem you solve and outcome you create').fill(e2eFixtures.offer.context)
  await page.getByRole('button', { name: 'Build meeting brief' }).click()

  await expect(page).toHaveURL(/\/dashboard\/research\/.+/)
  await expect(page.getByRole('link', { name: 'Use this brief' }).first()).toBeVisible({ timeout: 20_000 })

  await page.getByRole('link', { name: 'Use this brief' }).first().click()
  await expect(page).toHaveURL(/\/dashboard\/briefs\/.+/)

  await expect(page.getByRole('link', { name: 'Open contact & next steps' })).toHaveAttribute('href', /\/dashboard\/contacts\/[^/]+$/)
  const privateBriefUrl = page.url()
  const briefId = privateBriefUrl.split('/').pop()
  const shareResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/deal-briefs/${briefId}/share`))
  await page.getByRole('button', { name: 'Share brief' }).click()
  const shareResponse = await shareResponsePromise
  expect(shareResponse.ok()).toBeTruthy()
  const share = await shareResponse.json() as { token: string }

  await page.goto(`/shared/briefs/${share.token}`)
  await expect(page.getByText('Shared read-only brief')).toBeVisible()
  await expect(page.getByRole('heading', { name: `${e2eFixtures.prospect.name} at ${e2eFixtures.prospect.companyName}` })).toBeVisible()

  await page.goto(privateBriefUrl)
  await expect(page.getByRole('button', { name: 'Copy public link' })).toBeVisible()
  await page.getByRole('button', { name: 'Revoke' }).click()
  const revokedShare = await request.get(`${apiURL}/shared/briefs/${share.token}`)
  expect(revokedShare.status()).toBe(410)

  await page.goto(`/shared/briefs/${share.token}`)
  await expect(page.getByRole('heading', { name: 'This shared brief is no longer available.' })).toBeVisible()

  await page.goto(privateBriefUrl)
  await expect(page.getByRole('heading', { name: 'Connect the signal to your offer' })).toBeVisible()
  await expect(page.getByRole('tabpanel')).toContainText('Hypothesis to validate')
  await expect(page.getByRole('tabpanel')).toContainText(e2eFixtures.citation.claim)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab').first().click()
  await expect(page.getByRole('tabpanel')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.getByText('1 cited signal selected from 2 collected claims')).toBeVisible()
  await expect(page.getByText('An unrelated historical company fact.')).toHaveCount(0)
  await page.getByRole('button', { name: /^View source 1:/ }).click()
  await expect(page.getByTestId('evidence-disclosure')).toHaveAttribute('open', '')
  await expect(page.locator('article[id^="evidence-"]').first()).toBeFocused()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download brief' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('Lead-Trace-meeting-brief.txt')
  const citation = page.locator(`a[href="${e2eFixtures.citation.url}"]`)
  await expect(citation.first()).toBeVisible()
  await expect(citation.first()).toHaveAttribute('target', '_blank')

  await page.getByRole('button', { name: 'Refresh brief' }).click()
  await expect(page.getByText('Meeting brief · Refreshing')).toBeVisible()
  await expect(page.getByText('1 claim used in this brief')).toBeVisible()
  await expect(page.getByText('Meeting brief · Ready')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Changes since last refresh')).toBeVisible()
})
