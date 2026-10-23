'use client'

import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { AccountContext } from '../lib/account-context'
import { authClient, consumeAuthReturn } from '../lib/auth-client'
import { useResendCooldown } from '../lib/use-resend-cooldown'
import { Button } from './ui/button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

type ChallengeMethod = 'totp' | 'email' | 'backup'

export function TwoFactorChallenge({ context }: { context: AccountContext }) {
  const router = useRouter()
  const methods: { id: ChallengeMethod; label: string; icon: typeof ShieldCheck }[] = context.user.authenticatorAppEnabled
    ? [
        { id: 'totp', label: 'Authenticator', icon: ShieldCheck },
        { id: 'email', label: 'Email code', icon: Mail },
        { id: 'backup', label: 'Recovery code', icon: KeyRound },
      ]
    : [{ id: 'email', label: 'Email code', icon: Mail }]
  const [method, setMethod] = useState<ChallengeMethod>(context.user.authenticatorAppEnabled ? 'totp' : 'email')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const resendCooldown = useResendCooldown({
    storageKey: `lead-trace:two-factor-email:${context.user.id}`,
  })
  const [trustDevice, setTrustDevice] = useState(false)

  function chooseMethod(next: ChallengeMethod) {
    setMethod(next)
    setCode('')
    setError('')
  }

  async function sendEmailCode() {
    if (pending || resendCooldown.locked) return
    setPending(true)
    setError('')
    const result = await authClient.twoFactor.sendOtp()
    if (result.error) setError(result.error.message || 'Could not send the email code.')
    else resendCooldown.start()
    setPending(false)
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')

    const result = method === 'totp'
      ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
      : method === 'email'
        ? await authClient.twoFactor.verifyOtp({ code, trustDevice })
        : await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })

    if (result.error) {
      setError(result.error.message || 'That code could not be verified.')
      setPending(false)
      return
    }

    resendCooldown.reset()
    router.push(consumeAuthReturn())
    router.refresh()
  }

  const numericCode = method !== 'backup'
  const submitDisabled = pending || !code.trim() || (numericCode && code.length !== 6) || (method === 'email' && !resendCooldown.sent)

  return <form className="grid gap-4" onSubmit={verify}>
    {methods.length > 1 && <div className="grid grid-cols-3 gap-2" aria-label="Verification method">
      {methods.map(({ id, label, icon: Icon }) => <Button key={id} type="button" variant={method === id ? 'primary' : 'secondary'} size="xs" className="min-w-0 px-2" onClick={() => chooseMethod(id)} aria-pressed={method === id} disabled={pending}>
        <Icon size={14}/><span className="truncate">{label}</span>
      </Button>)}
    </div>}

    {method === 'totp' && <FormMessage>Enter the current six-digit code from your authenticator app.</FormMessage>}
    {method === 'email' && <>
      <FormMessage>{resendCooldown.sent ? `A code was sent to ${context.user.email}.` : 'Send a one-time code to your verified email.'}</FormMessage>
      {pending
        ? <Button className="w-full" type="button" variant="secondary" disabled>Sending…</Button>
        : resendCooldown.locked
          ? <p className="m-0 text-center text-[.78rem] font-medium text-lt-500" role="status">{resendCooldown.ready ? `Resend available in ${resendCooldown.secondsRemaining}s` : 'Checking email status…'}</p>
          : <Button className="w-full" type="button" variant="secondary" onClick={sendEmailCode}>{resendCooldown.sent ? 'Resend email code' : 'Send email code'}</Button>}
    </>}
    {method === 'backup' && <FormMessage>Use one of the single-use recovery codes you saved during setup.</FormMessage>}

    {(method !== 'email' || resendCooldown.sent) && <>
      <Field
        id="code"
        name="code"
        label={method === 'backup' ? 'Recovery code' : 'Six-digit security code'}
        inputMode={numericCode ? 'numeric' : 'text'}
        pattern={numericCode ? '[0-9]{6}' : undefined}
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(numericCode ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)}
        required
      />
      <label className="flex items-center gap-2.5 text-[.84rem] text-lt-600"><input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} className="size-4 accent-brand"/>Trust this device for 30 days</label>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button className="w-full" type="submit" disabled={submitDisabled}>{pending ? 'Checking…' : 'Verify identity'}</Button>
    </>}
    {method === 'email' && !resendCooldown.sent && error && <FormMessage tone="error">{error}</FormMessage>}
  </form>
}
