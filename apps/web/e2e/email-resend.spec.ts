import { expect, test } from '@playwright/test'

test('verification email resend is manual and its cooldown survives reload', async ({ page }) => {
  const email = 'resend-test@example.com'
  const storageKey = `lead-trace:email-verification:${email}`
  let resendRequests = 0

  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/auth/send-verification-email')) {
      resendRequests += 1
    }
  })

  await page.goto(`/verify-email?email=${encodeURIComponent(email)}`)
  await expect(page.getByRole('status')).toHaveText(/Resend available in \d+s/)
  await expect(page.getByRole('button', { name: 'Resend verification email' })).toHaveCount(0)
  expect(resendRequests).toBe(0)

  await page.reload()
  await expect(page.getByRole('status')).toHaveText(/Resend available in \d+s/)
  await expect(page.getByRole('button', { name: 'Resend verification email' })).toHaveCount(0)
  expect(resendRequests).toBe(0)

  await page.evaluate(({ key }) => {
    window.localStorage.setItem(key, String(Date.now() - 61_000))
  }, { key: storageKey })
  await page.reload()

  const resendButton = page.getByRole('button', { name: 'Resend verification email' })
  await expect(resendButton).toBeEnabled()
  await resendButton.click()
  await expect(page.getByText('A new verification email has been sent.')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(/Resend available in \d+s/)
  await expect(page.getByRole('button', { name: 'Resend verification email' })).toHaveCount(0)
  expect(resendRequests).toBe(1)

  await page.reload()
  await expect(page.getByRole('status')).toHaveText(/Resend available in \d+s/)
  await expect(page.getByRole('button', { name: 'Resend verification email' })).toHaveCount(0)
  await page.waitForTimeout(6_200)
  expect(resendRequests).toBe(1)
})
