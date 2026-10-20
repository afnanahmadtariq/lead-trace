import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '../../components/auth-form'
import { AuthIntro, AuthShell } from '../../components/auth-shell'

export const metadata: Metadata = { title: 'Sign in · Lead Trace' }
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const requested = (await searchParams).next
  const next = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/auth/continue'
  return <AuthShell mode="sign-in"><AuthIntro title="Sign in to Lead Trace">New here? <Link className="font-semibold text-brand" href={`/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link></AuthIntro><AuthForm mode="sign-in" callbackPath={next}/></AuthShell>
}
