import type { Metadata } from 'next'
import { ResetPasswordForm } from '../../components/account-actions'
import { AuthIntro, AuthShell } from '../../components/auth-shell'
export const metadata: Metadata = { title: 'Choose a new password · Lead Trace' }
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = '' } = await searchParams; return <AuthShell mode="sign-in"><AuthIntro title="Choose a new password">Use a unique password with at least 10 characters.</AuthIntro><ResetPasswordForm token={token}/></AuthShell> }
