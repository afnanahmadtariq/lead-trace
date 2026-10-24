import { expect, test } from '@playwright/test'
import { e2eFixtures } from './fixtures.mjs'

const apiURL = `http://127.0.0.1:${process.env.E2E_API_PORT || 3001}`
const webURL = `http://127.0.0.1:${process.env.E2E_WEB_PORT || 3000}`

test('all dashboard pages keep a single compact title, context and reachable controls', async ({ page, request }) => {
  test.skip(process.env.E2E_USE_REAL_STACK === 'true', 'Uses isolated UI fixtures')
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const response = await request.post(`${apiURL}/api/auth/sign-in/email`, { data: { email: e2eFixtures.user.email, password: e2eFixtures.user.password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  await page.context().addCookies([webURL, apiURL].map((url) => ({ name: 'lead-trace.session_token', value: token, url, httpOnly: true, sameSite: 'Lax' as const })))
  const routes = [
    ['/dashboard', 'Overview'], ['/dashboard/leads', 'Find leads'], ['/dashboard/contacts', 'Contacts'], ['/dashboard/pipeline', 'Pipeline'],
    ['/dashboard/tasks', 'Follow-ups'], ['/dashboard/research', 'Research'], ['/dashboard/research/new', 'New conversation brief'],
    ['/dashboard/briefs', 'Conversation briefs'], ['/dashboard/evidence', 'Evidence library'], ['/dashboard/integrations', 'Integrations'],
    ['/dashboard/workspace', 'Workspace settings'], ['/dashboard/profile', 'Profile'], ['/dashboard/settings', 'Settings & security'],
  ]
  const header = page.locator('[data-dashboard-topbar]')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const [route, title] of routes) {
      await page.goto(route)
      await expect(header.getByRole('heading', { name: title, exact: true })).toBeVisible()
      if (width <= 900) await expect(header.getByRole('button', { name: 'Open navigation', exact: true })).toBeVisible()
      else await expect(header.getByRole('button', { name: 'Open navigation', exact: true })).not.toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} at ${width}px`).toBeTruthy()
      const bounds = await header.boundingBox()
      expect(bounds!.y).toBeCloseTo(0, 0)
      expect(bounds!.height).toBeLessThan(120)
    }
  }
  await page.goto('/dashboard/leads/header-lead-search')
  await expect(header.getByRole('heading', { name: 'London SaaS sales leaders', exact: true })).toBeVisible()
  await expect(header).toContainText('Head of sales · B2B SaaS · London, United Kingdom · Growing sales teams')
  await header.getByRole('button', { name: 'About this page' }).click()
  await expect(page.getByRole('tooltip')).toContainText('London, United Kingdom')
  await expect(page.getByRole('tooltip')).toBeInViewport({ ratio: 1 })
  const name = 'Alexandra Morgan with a deliberately long full name'
  const contactResponse = await request.post(`${apiURL}/crm/contacts`, { headers: { cookie: `lead-trace.session_token=${token}` }, data: { name, email: 'header-layout@crm.test', companyName: 'International Sales Operations', jobTitle: 'Director of sales', lifecycle: 'lead' } })
  expect(contactResponse.ok()).toBeTruthy()
  const contact = await contactResponse.json()
  await page.goto(`/dashboard/contacts/${contact.id}`)
  for (const width of [901, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    const heading = header.getByRole('heading', { name, exact: true })
    await expect(heading).toBeVisible()
    expect((await heading.boundingBox())!.width).toBeGreaterThan(50)
    await expect(header.getByRole('button', { name: 'Edit contact', exact: true })).toBeInViewport({ ratio: 1 })
    await expect(header.getByRole('link', { name: 'Research contact', exact: true })).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  }
  expect(errors).toEqual([])
})

test('compact page header preserves actions, guidance, navigation and mobile space', async ({ page, request }) => {
  test.skip(process.env.E2E_USE_REAL_STACK === 'true', 'Uses isolated UI fixtures')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const response = await request.post(`${apiURL}/api/auth/sign-in/email`, { data: { email: e2eFixtures.user.email, password: e2eFixtures.user.password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  await page.context().addCookies([webURL, apiURL].map((url) => ({ name: 'lead-trace.session_token', value: token, url, httpOnly: true, sameSite: 'Lax' as const })))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/dashboard/pipeline')
  const header = page.locator('[data-dashboard-topbar]')
  await expect(header.getByRole('heading', { name: 'Pipeline', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  const addDeal = header.getByRole('button', { name: 'Add deal', exact: true })
  await expect(addDeal).toBeVisible()
  await addDeal.click()
  await expect(page.getByRole('dialog', { name: 'Add deal', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(addDeal).toBeFocused()

  const info = header.getByRole('button', { name: 'About this page', exact: true })
  await info.hover()
  await expect(page.getByRole('tooltip')).toContainText('A deal is a potential sale linked to a contact.')
  const controlledId = await info.getAttribute('aria-controls')
  const descriptionId = await info.getAttribute('aria-describedby')
  expect(controlledId).toBeTruthy()
  expect(descriptionId).toBeTruthy()
  await expect(page.locator(`[id="${controlledId}"]`)).toHaveAttribute('role', 'tooltip')
  await expect(page.locator(`[id="${descriptionId}"]`)).toContainText('A deal is a potential sale linked to a contact.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).not.toBeVisible()
  await info.focus()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Table view', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Pipeline summary' })).toContainText('Open value')
  const metrics = await page.getByRole('group', { name: 'Pipeline summary' }).boundingBox()
  expect(metrics!.height).toBeLessThan(90)
  const table = await page.getByRole('region', { name: 'Deals table' }).boundingBox()
  expect(table!.y).toBeLessThan(300)
  if (process.env.CRM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CRM_SCREENSHOT_DIR}/compact-pipeline-desktop.png`, fullPage: true, animations: 'disabled' })

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(addDeal).toBeVisible()
    if (width <= 700) await expect(header.locator('[data-page-heading] > svg')).not.toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await info.click()
    await expect(page.getByRole('tooltip')).toBeInViewport({ ratio: 1 })
    await page.keyboard.press('Escape')
  }
  if (process.env.CRM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CRM_SCREENSHOT_DIR}/compact-pipeline-mobile.png`, fullPage: true, animations: 'disabled' })

  await header.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Workspace menu' })).toBeInViewport({ ratio: 1 })
  await page.getByRole('link', { name: 'Follow-ups', exact: true }).click()
  await expect(header.getByRole('heading', { name: 'Follow-ups', exact: true })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Add follow-up', exact: true })).toBeVisible()
  await expect(addDeal).not.toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await header.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await page.getByRole('link', { name: 'Contacts', exact: true }).click()
  await expect(header.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Research prospect', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  expect(errors).toEqual([])
})

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
