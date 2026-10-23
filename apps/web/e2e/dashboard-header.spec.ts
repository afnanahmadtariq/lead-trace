import { expect, test } from '@playwright/test'
import { e2eFixtures } from './fixtures.mjs'

const apiURL = `http://127.0.0.1:${process.env.E2E_API_PORT || 3001}`
const webURL = `http://127.0.0.1:${process.env.E2E_WEB_PORT || 3000}`

test('dashboard header stays fully visible while scrolling on desktop and mobile', async ({ page, request }) => {
  test.skip(process.env.E2E_USE_REAL_STACK === 'true', 'Uses isolated UI fixtures')
  const response = await request.post(`${apiURL}/api/auth/sign-in/email`, { data: { email: e2eFixtures.user.email, password: e2eFixtures.user.password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  await page.context().addCookies([webURL, apiURL].map((url) => ({ name: 'lead-trace.session_token', value: token, url, httpOnly: true, sameSite: 'Lax' as const })))
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/dashboard')
  const header = page.getByRole('banner').filter({ has: page.getByRole('button', { name: /unread notifications/ }) })
  const notifications = header.getByRole('button', { name: /unread notifications/ })

  async function expectVisibleHeader() {
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await expect(header).toBeInViewport({ ratio: 1 })
    const bounds = await header.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.y).toBeCloseTo(0, 0)
    const actionBounds = await notifications.boundingBox()
    expect(actionBounds!.y).toBeGreaterThanOrEqual(bounds!.y)
    expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  }

  await expectVisibleHeader()
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await expectVisibleHeader()
  if (process.env.CRM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CRM_SCREENSHOT_DIR}/header-desktop.png`, animations: 'disabled', caret: 'initial' })
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Collapse sidebar', exact: true })).toBeVisible()
  await expectVisibleHeader()
  await page.setViewportSize({ width: 390, height: 844 })
  await expectVisibleHeader()
  await notifications.click()
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeInViewport({ ratio: 1 })
  await page.getByRole('button', { name: 'Close notifications', exact: true }).click()
  if (process.env.CRM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CRM_SCREENSHOT_DIR}/header-mobile.png`, animations: 'disabled', caret: 'initial' })
})
