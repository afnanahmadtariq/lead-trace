'use client'

import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { API_URL } from './api-client'
import { safeAuthPath } from './safe-path'

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/api/auth',
  fetchOptions: { credentials: 'include' },
  plugins: [
    twoFactorClient({ twoFactorPage: '/two-factor' }),
    organizationClient(),
  ],
})

export function webCallbackURL(path: string) {
  return new URL(path, window.location.origin).toString()
}

const authReturnKey = 'lead-trace-auth-return'

export function rememberAuthReturn(path: string) {
  window.sessionStorage.setItem(authReturnKey, safeAuthPath(path))
}

export function consumeAuthReturn() {
  const path = window.sessionStorage.getItem(authReturnKey)
  window.sessionStorage.removeItem(authReturnKey)
  return safeAuthPath(path)
}

export function clearAuthReturn() {
  window.sessionStorage.removeItem(authReturnKey)
}
