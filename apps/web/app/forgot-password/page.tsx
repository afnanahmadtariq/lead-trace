import type { Metadata } from 'next'
import { ForgotPasswordForm } from '../../components/account-actions'
import { AuthIntro, AuthShell } from '../../components/auth-shell'
export const metadata: Metadata = { title: 'Reset password · Lead Trace' }
export default function Page() { return <AuthShell mode="sign-in"><AuthIntro title="Reset your password">We will send a secure, time-limited link to your verified email.</AuthIntro><ForgotPasswordForm/></AuthShell> }
