import type { Metadata } from 'next'
import { VerifyEmailActions } from '../../components/account-actions'
import { AuthIntro, AuthShell } from '../../components/auth-shell'
export const metadata: Metadata = { title: 'Verify email · Lead Trace' }
export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) { const { email = '' } = await searchParams; return <AuthShell mode="sign-up"><AuthIntro title="Check your inbox">Verify your email before entering your intelligence workspace.</AuthIntro><VerifyEmailActions email={email}/></AuthShell> }
