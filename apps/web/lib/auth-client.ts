'use client'

import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { API_URL } from './api-client'

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
  const safePath = path.startsWith('/') && !path.startsWith('//') ? path : '/auth/continue'
  window.sessionStorage.setItem(authReturnKey, safePath)
}

export function consumeAuthReturn() {
  const path = window.sessionStorage.getItem(authReturnKey)
  window.sessionStorage.removeItem(authReturnKey)
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/auth/continue'
}

export function clearAuthReturn() {
  window.sessionStorage.removeItem(authReturnKey)
}
