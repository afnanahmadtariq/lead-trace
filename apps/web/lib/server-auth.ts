import 'server-only'

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import type { AccountContext } from './account-context'
import { API_URL } from './api-client'

export async function authenticatedFetch<T>(path: string): Promise<T | null> {
  const requestHeaders = await headers()
  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: { cookie: requestHeaders.get('cookie') || '' },
  })
  if (response.status === 401) return null
  if (response.status === 404) notFound()
  if (!response.ok) throw new Error(`Lead Trace API returned ${response.status} for ${path}`)
  return response.json() as Promise<T>
}

// Page data: 401 means the session expired, so send the user to sign in instead of rendering an empty state.
export async function requireFetch<T>(path: string) {
  return (await authenticatedFetch<T>(path)) ?? redirect('/sign-in')
}

export const getAccountContext = cache(async () => authenticatedFetch<AccountContext>('/account-context'))

export async function requireAccountContext() {
  const context = await getAccountContext()
  if (!context) redirect('/sign-in')
  return context
}

export async function requireWorkspace() {
  const context = await requireAccountContext()
  if (context.requirements.requiresOnboarding || context.requirements.requiresWorkspaceSelection) redirect('/onboarding')
  if (context.requirements.requiresTwoFactorChallenge) redirect('/two-factor')
  if (!context.activeWorkspace) redirect(context.destination)
  return { ...context, activeWorkspace: context.activeWorkspace }
}
