import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '../../components/auth-form'
import { AuthIntro, AuthShell } from '../../components/auth-shell'

export const metadata: Metadata = { title: 'Create account · Lead Trace' }
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const requested = (await searchParams).next
  const next = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/auth/continue'
  return <AuthShell mode="sign-up"><AuthIntro title="Create your account">Already using Lead Trace? <Link className="font-semibold text-brand" href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link></AuthIntro><AuthForm mode="sign-up" callbackPath={next}/></AuthShell>
}
