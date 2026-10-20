'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { authClient, webCallbackURL } from '../lib/auth-client'
import { useResendCooldown } from '../lib/use-resend-cooldown'
import { Button } from './ui/button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

function ReturnToSignIn() {
  return <p className="mt-0.5 mb-0 text-center text-sm text-lt-600"><Link className="font-semibold text-brand" href="/sign-in">Return to sign in</Link></p>
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const email = String(new FormData(event.currentTarget).get('email') || '').trim().toLowerCase()
    const result = await authClient.requestPasswordReset({ email, redirectTo: webCallbackURL('/reset-password') })
    if (result.error) setError(result.error.message || 'Could not send the reset link'); else setSent(true)
  }
  return <form className="grid gap-4" onSubmit={submit}><Field id="email" name="email" type="email" label="Email address" required/>{sent && <FormMessage tone="success">If an account exists, a reset link is on its way.</FormMessage>}{error && <FormMessage tone="error">{error}</FormMessage>}<Button className="w-full" type="submit">Send reset link</Button><ReturnToSignIn/></form>
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter(); const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('')
    const form = new FormData(event.currentTarget); const password = String(form.get('password') || ''); const confirmation = String(form.get('confirmation') || '')
    if (password !== confirmation) { setError('Passwords do not match'); setPending(false); return }
    const result = await authClient.resetPassword({ newPassword: password, token })
    if (result.error) { setError(result.error.message || 'Could not update your password'); setPending(false); return }
    router.push('/sign-in?reset=complete')
  }
  return <form className="grid gap-4" onSubmit={submit}><Field id="password" name="password" type="password" label="New password" minLength={10} maxLength={128} required/><Field id="confirmation" name="confirmation" type="password" label="Confirm password" minLength={10} maxLength={128} required/>{error && <FormMessage tone="error">{error}</FormMessage>}<Button className="w-full" type="submit" disabled={pending || !token}>{pending ? 'Updating…' : 'Update password'}</Button></form>
}

export function VerifyEmailActions({ email }: { email: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const resendCooldown = useResendCooldown({
    startLocked: true,
    storageKey: `lead-trace:email-verification:${email.trim().toLowerCase()}`,
  })

  async function resend() {
    if (!email || pending || resendCooldown.locked) return
    setPending(true)
    setError('')
    const result = await authClient.sendVerificationEmail({ email, callbackURL: webCallbackURL('/auth/continue') })
    if (result.error) {
      setError(result.error.message || 'Could not resend verification')
      setPending(false)
      return
    }
    setSent(true)
    resendCooldown.start()
    setPending(false)
  }

  return <div className="grid gap-4">
    <FormMessage>Open the verification link sent to <strong>{email || 'your email address'}</strong>. It expires in one hour.</FormMessage>
    {sent && <FormMessage tone="success">A new verification email has been sent.</FormMessage>}
    {error && <FormMessage tone="error">{error}</FormMessage>}
    {pending
      ? <Button className="w-full" type="button" variant="secondary" disabled>Sending…</Button>
      : resendCooldown.locked
        ? <p className="m-0 text-center text-[.78rem] font-medium text-lt-500" role="status">{resendCooldown.ready ? `Resend available in ${resendCooldown.secondsRemaining}s` : 'Checking email status…'}</p>
        : <Button className="w-full" type="button" variant="secondary" onClick={resend} disabled={!email}>Resend verification email</Button>}
    <ReturnToSignIn/>
  </div>
}
