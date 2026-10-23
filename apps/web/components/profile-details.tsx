'use client'

import { CheckCircle2, Pencil, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { AccountContext, WorkspaceSummary } from '../lib/account-context'
import { authClient, webCallbackURL } from '../lib/auth-client'
import { Button } from './ui/button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback
}

export function ProfileDetails({ user, workspace }: { user: AccountContext['user']; workspace: WorkspaceSummary }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    const nextEmail = email.trim().toLowerCase()
    setError('')
    setSuccess('')
    if (nextName.length < 2) {
      setError('Enter at least two characters for your display name.')
      return
    }
    setPending(true)
    try {
      if (nextName !== user.name) {
        const result = await authClient.updateUser({ name: nextName })
        if (result.error) throw new Error(errorMessage(result.error, 'Your display name could not be updated.'))
      }
      if (nextEmail !== user.email.toLowerCase()) {
        const result = await authClient.changeEmail({ newEmail: nextEmail, callbackURL: webCallbackURL('/dashboard/profile') })
        if (result.error) throw new Error(errorMessage(result.error, 'That email change could not be requested.'))
        setEmail(user.email)
        setSuccess(`Email change requested for ${nextEmail}. Your sign-in email remains ${user.email} until you confirm the current inbox and then verify the new address.`)
      } else {
        setSuccess('Your details have been updated.')
      }
      setEditing(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your details could not be updated.')
    } finally {
      setPending(false)
    }
  }

  return <div className="grid gap-[18px]">
    <section className="rounded-[17px] border border-lt-200 bg-white p-[23px]">
      <div className="flex items-center gap-4 max-[520px]:items-start">
        <span className="grid size-14 shrink-0 place-items-center rounded-[17px] bg-[linear-gradient(135deg,#dff3ff,#dce8ff)] text-base font-bold text-lt-900">{initials || <UserRound size={22}/>}</span>
        <div className="min-w-0 flex-1"><h2 className="m-0 truncate text-[1.15rem] tracking-[-.02em] text-lt-900">{user.name}</h2><p className="mt-1 mb-0 truncate text-[.84rem] text-lt-500">{user.email}</p></div>
        <span className={user.emailVerified ? 'inline-flex items-center gap-1.5 rounded-full bg-[#eef9f3] px-2.5 py-1 text-[.7rem] font-semibold text-success' : 'inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[.7rem] font-semibold text-amber-700'}><CheckCircle2 size={13}/>{user.emailVerified ? 'Email verified' : 'Email unverified'}</span>
      </div>
      <dl className="mt-5 mb-0 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <div className="rounded-xl bg-lt-50 p-3.5"><dt className="text-[.67rem] tracking-[.08em] text-lt-500 uppercase">Workspace</dt><dd className="mt-1 mb-0 text-sm font-semibold text-lt-900">{workspace.name}</dd></div>
        <div className="rounded-xl bg-lt-50 p-3.5"><dt className="text-[.67rem] tracking-[.08em] text-lt-500 uppercase">Role</dt><dd className="mt-1 mb-0 text-sm font-semibold text-lt-900">{workspace.role === 'owner' ? 'Creator admin' : workspace.role.replace(/^./, (letter) => letter.toUpperCase())}</dd></div>
      </dl>
      <div className="mt-5 border-t border-lt-100 pt-4"><Button type="button" variant="secondary" size="sm" onClick={() => { setEditing((value) => { if (!value) { setName(user.name); setEmail(user.email) } return !value }); setError(''); setSuccess('') }}><Pencil size={16}/>{editing ? 'Close details' : 'Change details'}</Button></div>
      {!editing && error && <div className="mt-4"><FormMessage tone="error">{error}</FormMessage></div>}
      {!editing && success && <div className="mt-4"><FormMessage tone="success">{success}</FormMessage></div>}
    </section>

    {editing && <section className="rounded-[17px] border border-lt-200 bg-white p-[23px]">
      <header><h2 className="m-0 text-[1.08rem] text-lt-900">Change details</h2><p className="mt-1 mb-0 text-[.8rem] leading-[1.5] text-lt-500">Save all changes together. Email changes need confirmation from your current inbox.</p></header>
      <form className="mt-5 grid max-w-[620px] gap-4" onSubmit={save}>
        <Field id="profile-name" name="name" label="Your name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required/>
        <Field id="profile-email" name="email" type="email" label="Sign-in email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required/>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {success && <FormMessage tone="success">{success}</FormMessage>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button><Button type="button" variant="ghost" onClick={() => { setName(user.name); setEmail(user.email); setEditing(false) }} disabled={pending}>Cancel</Button></div>
      </form>
    </section>}
  </div>
}
