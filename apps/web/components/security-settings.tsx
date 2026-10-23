'use client'

import { ArrowLeft, Check, Mail, ShieldCheck, ShieldOff, Smartphone, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { AccountContext } from '../lib/account-context'
import { apiRequest, errorMessage } from '../lib/api-client'
import { authClient, webCallbackURL } from '../lib/auth-client'
import { useResendCooldown } from '../lib/use-resend-cooldown'
import { Button } from './ui/button'
import { CopyButton } from './ui/copy-button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

type Setup = { totpURI: string; backupCodes: string[] }
type SetupPlan = 'email' | 'authenticator'
type SetupStep = 'closed' | 'choose' | 'confirm' | 'connect' | 'recovery' | 'complete'

function classes(...values: Array<string | false>) { return values.filter(Boolean).join(' ') }

function SetupFlow({ children }: { children: ReactNode }) {
  return <section className="grid w-full gap-6 rounded-[17px] border border-lt-200 bg-white p-[23px]" role="region" aria-labelledby="two-factor-setup-title">{children}</section>
}

function FlowHeader({ step, plan, onBack, onClose, canClose }: { step: SetupStep; plan: SetupPlan; onBack?: () => void; onClose: () => void; canClose: boolean }) {
  const stepNumber = step === 'choose' ? 1 : step === 'confirm' ? 2 : step === 'connect' ? 3 : step === 'recovery' ? 4 : plan === 'authenticator' ? 4 : 3
  const total = plan === 'authenticator' ? 4 : 3
  const title = step === 'choose' ? 'Enable two-factor authentication' : step === 'confirm' ? 'Confirm your choice' : step === 'connect' ? 'Connect your authenticator' : step === 'recovery' ? 'Save your recovery codes' : 'Two-factor authentication is ready'

  return <header className="flex items-start gap-3 border-b border-lt-200 pb-5">
    {onBack ? <button type="button" onClick={onBack} className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-lt-200 text-lt-600 transition-colors hover:bg-lt-50 hover:text-lt-900" aria-label="Back"><ArrowLeft size={17}/></button> : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lt-100 text-brand"><ShieldCheck size={19}/></span>}
    <div className="min-w-0 flex-1"><p className="m-0 text-[.68rem] font-semibold tracking-[.08em] text-brand uppercase">Security setup</p><h2 id="two-factor-setup-title" className="mt-1 mb-0 text-[1.13rem] tracking-[-.02em] text-lt-900">{title}</h2></div>
    <span className="mt-1 shrink-0 rounded-full bg-lt-100 px-2.5 py-1 text-[.68rem] font-semibold text-brand">{stepNumber} / {total}</span>
    {canClose && <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-lt-500 transition-colors hover:bg-lt-50 hover:text-lt-900" aria-label="Close setup"><X size={19}/></button>}
  </header>
}

function Stepper({ step, plan }: { step: SetupStep; plan: SetupPlan }) {
  const steps = plan === 'authenticator' ? ['Choice', 'Confirm', 'Connect', 'Recovery'] : ['Choice', 'Confirm', 'Done']
  const current = step === 'choose' ? 0 : step === 'confirm' ? 1 : step === 'connect' ? 2 : step === 'recovery' ? 3 : steps.length - 1
  return <ol className="m-0 grid list-none grid-flow-col auto-cols-fr gap-2 rounded-[14px] border border-lt-200 bg-white p-4" aria-label="Two-factor setup progress">
    {steps.map((label, index) => <li className="grid gap-1" key={label}><span className={classes('h-1 rounded-full', index <= current ? 'bg-brand' : 'bg-lt-200')}/><span className={classes('text-[.67rem] font-medium', index === current ? 'text-lt-900' : 'text-lt-500')}>{label}</span></li>)}
  </ol>
}

export function SecuritySettings({ user, accountDeletion }: { user: AccountContext['user']; accountDeletion: AccountContext['accountDeletion'] }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(user.twoFactorEnabled)
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(user.authenticatorAppEnabled)
  const [plan, setPlan] = useState<SetupPlan>('email')
  const [step, setStep] = useState<SetupStep>('closed')
  const [addingAuthenticator, setAddingAuthenticator] = useState(false)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirmationCode, setSetupConfirmationCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [disableConfirmationCode, setDisableConfirmationCode] = useState('')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [accountDeletionConfirmation, setAccountDeletionConfirmation] = useState('')
  const [accountDeletionPassword, setAccountDeletionPassword] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const setupConfirmationCooldown = useResendCooldown({
    storageKey: `lead-trace:security-confirmation:enable:${user.id}`,
  })
  const disableConfirmationCooldown = useResendCooldown({
    storageKey: `lead-trace:security-confirmation:disable:${user.id}`,
  })
  const secret = (() => { if (!setup) return ''; try { return new URL(setup.totpURI).searchParams.get('secret') || '' } catch { return '' } })()

  function begin(action: string) { setPending(action); setError(''); setSuccess('') }
  function passwordField(id: string, value: string, setValue: (value: string) => void) {
    return user.hasPassword ? <Field id={id} name="password" type="password" label="Current password" autoComplete="current-password" value={value} onChange={(event) => setValue(event.target.value)} required/> : null
  }
  function openSetup() { setPlan('email'); setAddingAuthenticator(false); setStep('choose'); setSetup(null); setSetupPassword(''); setSetupConfirmationCode(''); setVerificationCode(''); setError(''); setSuccess('') }
  function openAddAuthenticator() { setPlan('authenticator'); setAddingAuthenticator(true); setStep('confirm'); setSetup(null); setSetupPassword(''); setSetupConfirmationCode(''); setVerificationCode(''); setError(''); setSuccess('') }
  function closeSetup() { if (pending) return; if (step === 'recovery') setRecoveryCodes([]); setStep('closed'); setSetup(null); setSetupPassword(''); setSetupConfirmationCode(''); setVerificationCode(''); setError('') }
  function goBack() { if (pending) return; setError(''); if (step === 'confirm' && !addingAuthenticator) setStep('choose'); if (step === 'connect') setStep('confirm') }

  async function sendSetupConfirmation() {
    if (pending || setupConfirmationCooldown.locked) return
    begin('send-enable-confirmation')
    try {
      await apiRequest('/account-context/security-confirmations', { method: 'POST', body: JSON.stringify({ action: 'enable-two-factor' }) })
      setupConfirmationCooldown.start()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The confirmation code could not be sent.')
    } finally {
      setPending(null)
    }
  }

  async function sendDisableConfirmation() {
    if (pending || disableConfirmationCooldown.locked) return
    begin('send-disable-confirmation')
    try {
      await apiRequest('/account-context/security-confirmations', { method: 'POST', body: JSON.stringify({ action: 'disable-two-factor' }) })
      disableConfirmationCooldown.start()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The confirmation code could not be sent.')
    } finally {
      setPending(null)
    }
  }

  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user.hasPassword) {
      if (!setupConfirmationCooldown.sent) {
        await sendSetupConfirmation()
        return
      }
      begin('verify-enable-confirmation')
      try {
        await apiRequest('/account-context/security-confirmations/verify', { method: 'POST', body: JSON.stringify({ action: 'enable-two-factor', code: setupConfirmationCode }) })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That confirmation code could not be verified.')
        setPending(null)
        return
      }
    }
    const action = plan === 'email' ? 'enable-email' : 'enable-authenticator'
    begin(action)
    const result = await authClient.twoFactor.enable({ method: plan === 'email' ? 'otp' : 'totp', password: user.hasPassword ? setupPassword : undefined })
    if (result.error) setError(errorMessage(result.error, plan === 'email' ? 'Email two-factor authentication could not be enabled.' : 'Authenticator setup could not be started.'))
    else if (plan === 'email') { setEnabled(true); setSetupPassword(''); setSetupConfirmationCode(''); setupConfirmationCooldown.reset(); setStep('complete'); router.refresh() }
    else if (result.data?.method === 'totp') { setSetup(result.data); setSetupPassword(''); setSetupConfirmationCode(''); setupConfirmationCooldown.reset(); setStep('connect') }
    else setError('Authenticator setup was not returned. Please try again.')
    setPending(null)
  }

  async function verifyAuthenticator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!setup) return
    begin('verify-authenticator')
    const result = await authClient.twoFactor.verifyTotp({ code: verificationCode })
    if (result.error) setError(errorMessage(result.error, 'That authenticator code is not valid.'))
    else { setEnabled(true); setAuthenticatorEnabled(true); setRecoveryCodes(setup.backupCodes); setVerificationCode(''); setStep('recovery'); router.refresh() }
    setPending(null)
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user.hasPassword) {
      if (!disableConfirmationCooldown.sent) {
        await sendDisableConfirmation()
        return
      }
      begin('verify-disable-confirmation')
      try {
        await apiRequest('/account-context/security-confirmations/verify', { method: 'POST', body: JSON.stringify({ action: 'disable-two-factor', code: disableConfirmationCode }) })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That confirmation code could not be verified.')
        setPending(null)
        return
      }
    }
    begin('disable-2fa')
    const result = await authClient.twoFactor.disable({ password: user.hasPassword ? disablePassword : undefined })
    if (result.error) setError(errorMessage(result.error, 'Two-factor authentication could not be disabled.'))
    else { setEnabled(false); setAuthenticatorEnabled(false); setRecoveryCodes([]); setDisablePassword(''); setDisableConfirmationCode(''); disableConfirmationCooldown.reset(); setSuccess('Two-factor authentication has been disabled.'); router.refresh() }
    setPending(null)
  }

  async function generateRecoveryCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); begin('recovery')
    const result = await authClient.twoFactor.generateBackupCodes({ password: user.hasPassword ? recoveryPassword : undefined })
    if (result.error) setError(errorMessage(result.error, 'New recovery codes could not be generated.'))
    else { setRecoveryCodes(result.data?.backupCodes || []); setRecoveryPassword(''); setPlan('authenticator'); setAddingAuthenticator(true); setStep('recovery') }
    setPending(null)
  }

  async function requestAccountDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    begin('delete-account')
    const result = await authClient.deleteUser({
      callbackURL: webCallbackURL('/'),
      password: user.hasPassword ? accountDeletionPassword : undefined,
    })
    if (result.error) setError(errorMessage(result.error, 'The account deletion confirmation could not be sent.'))
    else {
      setAccountDeletionConfirmation('')
      setAccountDeletionPassword('')
      setSuccess('We sent an account deletion link to your email. It expires in one hour.')
    }
    setPending(null)
  }

  const canCloseSetup = pending === null

  return <div className="grid gap-[18px]">
    {step === 'closed' && <section className="rounded-[17px] border border-lt-200 bg-white p-[23px]">
      <header className="flex items-start justify-between gap-4 border-b border-lt-100 pb-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lt-100 text-brand"><ShieldCheck size={20}/></span><div><h2 className="m-0 text-[1.08rem] text-lt-900">Two-factor authentication</h2><p className="mt-1 mb-0 text-[.8rem] leading-[1.5] text-lt-500">Add a second check whenever you sign in.</p></div></div><span className={enabled ? 'shrink-0 rounded-full bg-lt-100 px-2.5 py-1 text-[.7rem] font-semibold text-brand' : 'shrink-0 rounded-full bg-lt-50 px-2.5 py-1 text-[.7rem] font-semibold text-lt-600'}>{enabled ? 'Enabled' : 'Not enabled'}</span></header>
      <div className="mt-5">
        {error && <div className="mb-4"><FormMessage tone="error">{error}</FormMessage></div>}
        {success && <div className="mb-4"><FormMessage tone="success">{success}</FormMessage></div>}
        {!enabled ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-lt-200 bg-lt-50/60 p-5"><div><h3 className="m-0 text-[.95rem] text-lt-900">Protect this account</h3><p className="mt-1 mb-0 max-w-[520px] text-[.8rem] leading-[1.55] text-lt-600">Set up email security codes or an authenticator app as separate verification methods.</p></div><Button type="button" onClick={openSetup}>Enable 2FA</Button></div> : <div className="grid gap-4">
          <dl className="m-0 grid divide-y divide-lt-100 rounded-[14px] border border-lt-200"><div className="flex items-center justify-between gap-5 px-4 py-3.5"><div><dt className="text-[.84rem] font-semibold text-lt-900">Email security code</dt><dd className="mt-1 text-[.75rem] text-lt-500">Sent to {user.email} when it is needed.</dd></div><span className="text-[.74rem] font-semibold text-brand">Active</span></div><div className="flex items-center justify-between gap-5 px-4 py-3.5"><div><dt className="text-[.84rem] font-semibold text-lt-900">Authenticator app</dt><dd className="mt-1 text-[.75rem] text-lt-500">{authenticatorEnabled ? 'Verified and ready for offline codes.' : 'Not set up yet.'}</dd></div>{authenticatorEnabled ? <span className="text-[.74rem] font-semibold text-brand">Active</span> : <Button type="button" variant="secondary" size="xs" onClick={openAddAuthenticator}>Add app</Button>}</div></dl>
          <div className="flex flex-wrap items-start justify-between gap-4 border-t border-lt-100 pt-4"><div><h3 className="m-0 text-[.9rem] text-lt-900">Sign-in protection</h3><p className="mt-1 mb-0 text-[.76rem] leading-[1.5] text-lt-500">Turning this off removes the additional verification step.</p></div><form onSubmit={disableTwoFactor} className="grid min-w-[260px] gap-2">{user.hasPassword ? <label className="grid gap-1 text-[.7rem] font-medium text-lt-600">Current password<input type="password" name="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} className="h-9 rounded-control border border-lt-200 px-3 text-[.8rem] text-lt-900 outline-none focus:border-brand" required/></label> : disableConfirmationCooldown.sent ? <div className="grid gap-2"><Field id="disable-two-factor-confirmation" name="confirmationCode" label="Email confirmation code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" value={disableConfirmationCode} onChange={(event) => setDisableConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required/><div className="flex items-center justify-between gap-3"><span className="text-[.7rem] text-lt-500">Code sent to {user.email}</span>{disableConfirmationCooldown.locked ? <span className="text-[.7rem] font-medium text-lt-500" role="status">Resend available in {disableConfirmationCooldown.secondsRemaining}s</span> : <Button type="button" variant="ghost" size="xs" onClick={sendDisableConfirmation} disabled={pending !== null}>Resend code</Button>}</div></div> : <p className="m-0 text-[.75rem] leading-[1.5] text-lt-500">We will email a confirmation code to {user.email} before disabling 2FA.</p>}<div><Button type="submit" variant="danger" size="xs" disabled={pending !== null || (!user.hasPassword && !disableConfirmationCooldown.ready) || (user.hasPassword && !disablePassword) || (!user.hasPassword && disableConfirmationCooldown.sent && disableConfirmationCode.length !== 6)}><ShieldOff size={15}/>{pending === 'send-disable-confirmation' ? 'Sending code…' : pending === 'verify-disable-confirmation' || pending === 'disable-2fa' ? 'Disabling…' : !user.hasPassword && !disableConfirmationCooldown.sent ? 'Send confirmation code' : 'Disable 2FA'}</Button></div></form></div>
          {authenticatorEnabled && <form className="flex flex-wrap items-end justify-between gap-4 border-t border-lt-100 pt-4" onSubmit={generateRecoveryCodes}><div><h3 className="m-0 text-[.9rem] text-lt-900">Recovery codes</h3><p className="mt-1 mb-0 text-[.76rem] leading-[1.5] text-lt-500">Generate replacements if your saved codes are lost or exposed.</p></div><div className="flex flex-wrap items-end gap-2">{user.hasPassword && <label className="grid gap-1 text-[.7rem] font-medium text-lt-600">Current password<input type="password" name="password" autoComplete="current-password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} className="h-9 rounded-control border border-lt-200 px-3 text-[.8rem] text-lt-900 outline-none focus:border-brand" required/></label>}<Button type="submit" variant="secondary" size="xs" disabled={pending !== null || (user.hasPassword && !recoveryPassword)}>{pending === 'recovery' ? 'Generating…' : 'Generate new codes'}</Button></div></form>}
        </div>}
      </div>
    </section>}

    {step === 'closed' && <section className="rounded-[17px] border border-danger/25 bg-white p-[23px]"><header><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#fff3f4] text-danger"><Trash2 size={19}/></span><div><h2 className="m-0 text-[1.08rem] text-lt-900">Danger zone</h2><p className="mt-1 mb-0 text-[.8rem] leading-[1.5] text-lt-500">These actions are permanent.</p></div></div></header>
      <div className="mt-5 grid gap-4 border-t border-lt-100 pt-5">
        <form className="grid gap-3 rounded-[14px] border border-danger/25 p-4" onSubmit={requestAccountDeletion}><div><h3 className="m-0 text-[.9rem] text-lt-900">Delete account</h3><p className="mt-1 mb-0 text-[.76rem] leading-[1.5] text-lt-500">Permanently removes your sign-in, profile, sessions, and personal account records. Shared workspaces and their data stay available to their other members. We will email a final confirmation link before anything is deleted.</p></div>{accountDeletion.soleWorkspaceNames.length > 0 && <FormMessage>Your one-member workspace{accountDeletion.soleWorkspaceNames.length === 1 ? '' : 's'} ({accountDeletion.soleWorkspaceNames.join(', ')}) and its research data will also be deleted.</FormMessage>}<Field id="delete-account-confirmation" name="confirmation" label={'Type ' + user.email + ' to confirm'} value={accountDeletionConfirmation} onChange={(event) => setAccountDeletionConfirmation(event.target.value)} required/>{user.hasPassword && <Field id="delete-account-password" name="password" type="password" label="Current password" autoComplete="current-password" value={accountDeletionPassword} onChange={(event) => setAccountDeletionPassword(event.target.value)} required/>}<div><Button type="submit" variant="danger" size="xs" disabled={pending !== null || accountDeletionConfirmation !== user.email || (user.hasPassword && !accountDeletionPassword)}>{pending === 'delete-account' ? 'Sending confirmation…' : 'Delete account'}</Button></div></form>
      </div>
    </section>}

    {step !== 'closed' && <SetupFlow><FlowHeader step={step} plan={plan} onBack={step === 'confirm' && !addingAuthenticator || step === 'connect' ? goBack : undefined} onClose={closeSetup} canClose={canCloseSetup}/><Stepper step={step} plan={plan}/><div className="w-full">
      {error && <div className="mb-4"><FormMessage tone="error">{error}</FormMessage></div>}
      {step === 'choose' && <div className="grid gap-5"><p className="m-0 text-[.84rem] leading-[1.55] text-lt-600">Choose one verification method to set up. You can add the other method separately afterward.</p><div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1" role="radiogroup" aria-label="Two-factor setup choice"><button type="button" onClick={() => setPlan('email')} role="radio" aria-checked={plan === 'email'} className={classes('grid gap-2 rounded-[14px] border p-4 text-left transition-colors', plan === 'email' ? 'border-brand bg-lt-50 shadow-[inset_0_0_0_1px_rgb(23_104_199_/_10%)]' : 'border-lt-200 bg-white hover:bg-lt-50')}><Mail size={19} className="text-brand"/><strong className="text-[.9rem] text-lt-900">Email security code</strong><span className="text-[.76rem] leading-[1.5] text-lt-500">Receive a six-digit code at your verified email.</span></button><button type="button" onClick={() => setPlan('authenticator')} role="radio" aria-checked={plan === 'authenticator'} className={classes('grid gap-2 rounded-[14px] border p-4 text-left transition-colors', plan === 'authenticator' ? 'border-brand bg-lt-50 shadow-[inset_0_0_0_1px_rgb(23_104_199_/_10%)]' : 'border-lt-200 bg-white hover:bg-lt-50')}><Smartphone size={19} className="text-brand"/><strong className="text-[.9rem] text-lt-900">Authenticator app</strong><span className="text-[.76rem] leading-[1.5] text-lt-500">Use offline codes and keep single-use recovery codes.</span></button></div><div className="flex justify-end border-t border-lt-100 pt-4"><Button type="button" onClick={() => setStep('confirm')}>Continue</Button></div></div>}
      {step === 'confirm' && <form className="grid gap-5" onSubmit={confirmSetup}><div className="rounded-[14px] border border-lt-200 bg-lt-50/70 p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-white text-brand">{plan === 'email' ? <Mail size={17}/> : <Smartphone size={17}/>}</span><div><h3 className="m-0 text-[.92rem] text-lt-900">{plan === 'email' ? 'Email security code' : 'Authenticator app'}</h3><p className="mt-1 mb-0 text-[.78rem] leading-[1.55] text-lt-600">{plan === 'email' ? `A code will be sent to ${user.email} whenever a second factor is required.` : 'Scan a QR code and verify one authenticator code to activate this method.'}</p></div></div></div>{passwordField('two-factor-setup-password', setupPassword, setSetupPassword)}{!user.hasPassword && (setupConfirmationCooldown.sent ? <div className="grid gap-2"><Field id="enable-two-factor-confirmation" name="confirmationCode" label="Email confirmation code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" value={setupConfirmationCode} onChange={(event) => setSetupConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required/><div className="flex items-center justify-between gap-3"><span className="text-[.72rem] text-lt-500">Code sent to {user.email}</span>{setupConfirmationCooldown.locked ? <span className="text-[.7rem] font-medium text-lt-500" role="status">Resend available in {setupConfirmationCooldown.secondsRemaining}s</span> : <Button type="button" variant="ghost" size="xs" onClick={sendSetupConfirmation} disabled={pending !== null}>Resend code</Button>}</div></div> : <FormMessage>Because you sign in with Google or another provider, we will send a confirmation code to {user.email} before changing two-factor authentication.</FormMessage>)}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeSetup} disabled={!canCloseSetup}>Cancel</Button><Button type="submit" disabled={pending !== null || (!user.hasPassword && !setupConfirmationCooldown.ready) || (user.hasPassword && !setupPassword) || (!user.hasPassword && setupConfirmationCooldown.sent && setupConfirmationCode.length !== 6)}>{pending === 'send-enable-confirmation' ? 'Sending code…' : pending === 'verify-enable-confirmation' ? 'Confirming…' : pending === 'enable-email' ? 'Activating…' : pending === 'enable-authenticator' ? 'Preparing…' : !user.hasPassword && !setupConfirmationCooldown.sent ? 'Send confirmation code' : plan === 'email' ? 'Activate email codes' : 'Continue to app setup'}</Button></div></form>}
      {step === 'connect' && setup && <div className="grid gap-5"><div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 max-[520px]:grid-cols-1"><div className="w-fit rounded-[14px] border border-lt-200 bg-white p-3"><QRCodeSVG value={setup.totpURI} size={174} level="M" marginSize={1}/></div><div className="grid content-start gap-3"><div><h3 className="m-0 text-[.96rem] text-lt-900">Scan this code in your app</h3><p className="mt-1.5 mb-0 text-[.8rem] leading-[1.55] text-lt-600">Use any TOTP-compatible authenticator, then enter its current six-digit code below.</p></div>{secret && <div className="flex items-center gap-2 rounded-xl border border-lt-200 bg-lt-50 p-2.5"><code className="min-w-0 flex-1 break-all text-[.76rem] font-semibold tracking-[.06em] text-lt-900">{secret}</code><CopyButton value={secret}/></div>}</div></div><form className="grid gap-4" onSubmit={verifyAuthenticator}><Field id="authenticator-code" name="code" label="Six-digit authenticator code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required/><div className="flex justify-end"><Button type="submit" disabled={pending !== null || verificationCode.length !== 6}>{pending === 'verify-authenticator' ? 'Verifying…' : 'Verify and activate'}</Button></div></form></div>}
      {step === 'recovery' && <div className="grid gap-5"><div><h3 className="m-0 text-[.96rem] text-lt-900">Keep these somewhere safe</h3><p className="mt-1.5 mb-0 text-[.8rem] leading-[1.55] text-lt-600">Each recovery code works once. They are the fallback if you lose access to your authenticator app.</p></div><div className="grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">{recoveryCodes.map((code) => <code key={code} className="rounded-lg border border-lt-200 bg-lt-50 px-3 py-2 text-center text-[.82rem] font-semibold text-lt-900">{code}</code>)}</div><div className="flex flex-wrap justify-between gap-3"><CopyButton value={recoveryCodes.join('\n')} label="Copy all codes"/><Button type="button" onClick={closeSetup}><Check size={16}/>I saved these codes</Button></div></div>}
      {step === 'complete' && <div className="grid justify-items-center gap-5 py-3 text-center"><span className="grid size-12 place-items-center rounded-full bg-lt-100 text-brand"><Check size={23}/></span><div><h3 className="m-0 text-[1rem] text-lt-900">Email security codes are active</h3><p className="mt-2 mb-0 max-w-[420px] text-[.8rem] leading-[1.55] text-lt-600">When sign-in needs a second factor, you can request a code at {user.email}.</p></div><Button type="button" onClick={closeSetup}>Done</Button></div>}
    </div></SetupFlow>}
  </div>
}
