import { expect, test } from '@playwright/test'
import { e2eFixtures } from './fixtures.mjs'

const apiURL = `http://127.0.0.1:${process.env.E2E_API_PORT || 3001}`
const webURL = `http://127.0.0.1:${process.env.E2E_WEB_PORT || 3000}`

test('page end keeps the header pinned and sidebar controls reachable', async ({ page, request }) => {
  test.skip(process.env.E2E_USE_REAL_STACK === 'true', 'Uses isolated UI fixtures')
  const response = await request.post(`${apiURL}/api/auth/sign-in/email`, { data: { email: e2eFixtures.user.email, password: e2eFixtures.user.password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  await page.context().addCookies([webURL, apiURL].map((url) => ({ name: 'lead-trace.session_token', value: token, url, httpOnly: true, sameSite: 'Lax' as const })))
  for (const viewport of [{ width: 1440, height: 820 }, { width: 1280, height: 600 }, { width: 1280, height: 420 }, { width: 390, height: 640 }]) {
    await page.setViewportSize(viewport)
    for (const route of ['/dashboard/settings', '/dashboard/contacts', '/dashboard']) {
      await page.goto(route)
      const header = page.locator('[data-dashboard-topbar]')
      await expect(header.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('html')).toHaveCSS('overscroll-behavior-y', 'none')
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
      await expect.poll(async () => Math.abs((await header.boundingBox())!.y), `${route} at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      if (route === '/dashboard/settings') await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toBeInViewport({ ratio: 1 })
      if (route === '/dashboard/contacts' && viewport.height === 820) expect(await page.evaluate(() => scrollY)).toBe(0)
      if (viewport.width > 900) {
        const sidebar = page.locator('aside').first()
        const signOut = sidebar.getByRole('button', { name: 'Sign out', exact: true })
        await signOut.scrollIntoViewIfNeeded()
        await expect(signOut, `${route} at ${viewport.width}×${viewport.height}`).toBeInViewport({ ratio: 1 })
        expect(Math.abs((await sidebar.boundingBox())!.y)).toBeLessThanOrEqual(1)
        await sidebar.getByRole('link', { name: 'Home', exact: true }).scrollIntoViewIfNeeded()
        await expect(sidebar.getByRole('link', { name: 'Home', exact: true })).toBeInViewport({ ratio: 1 })
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 420 })
  await page.goto('/dashboard/settings')
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  const expand = page.getByRole('button', { name: 'Expand sidebar', exact: true })
  await expect(expand).toBeInViewport({ ratio: 1 })
  const signOut = page.locator('aside').first().getByRole('button', { name: 'Sign out', exact: true })
  await signOut.scrollIntoViewIfNeeded()
  await expect(signOut).toBeInViewport({ ratio: 1 })
  await expect(expand).toBeInViewport({ ratio: 1 })
  await page.goto('/about')
  await expect(page.locator('html')).toHaveCSS('overscroll-behavior-y', 'auto')
})
