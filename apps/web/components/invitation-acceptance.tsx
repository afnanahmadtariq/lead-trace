'use client'

import { ArrowRight, Building2, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { AccountContext } from '../lib/account-context'
import { authClient, clearAuthReturn } from '../lib/auth-client'
import { Button } from './ui/button'
import { FormMessage } from './ui/form-message'

export function InvitationAcceptance({ invitationId, user }: { invitationId: string; user: AccountContext['user'] | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const destination = `/invitation?id=${encodeURIComponent(invitationId)}`

  useEffect(() => clearAuthReturn(), [])

  async function accept() {
    if (!invitationId) return
    setPending(true)
    setError('')
    const result = await authClient.organization.acceptInvitation({ invitationId })
    if (result.error) {
      setError(result.error.message || 'This invitation could not be accepted. It may be expired or intended for another email address.')
      setPending(false)
      return
    }
    router.push('/dashboard/workspace')
    router.refresh()
  }

  return <section className="mx-auto mt-[110px] grid w-full max-w-[620px] gap-5 rounded-[22px] border border-lt-200 bg-white p-7 shadow-panel max-[560px]:mt-[70px] max-[560px]:p-5">
    <span className="grid size-12 place-items-center rounded-[15px] bg-lt-100 text-brand"><Building2 size={23}/></span>
    <div><p className="m-0 text-[.69rem] font-semibold tracking-[.11em] text-brand uppercase">Workspace invitation</p><h1 className="mt-2 mb-0 text-[clamp(2rem,6vw,3rem)] leading-[1.05] font-light tracking-[-.05em] text-lt-900">Join your team in Lead Trace.</h1><p className="mt-4 mb-0 text-[.93rem] leading-[1.65] text-lt-600">Accept to share prospects, research, and Deal Briefs with the workspace. Your personal sign-in and security settings remain separate.</p></div>
    {!invitationId && <FormMessage tone="error">This invitation link is incomplete. Ask a workspace admin to send a new invitation.</FormMessage>}
    {error && <FormMessage tone="error">{error}</FormMessage>}
    {user ? <div className="grid gap-4 rounded-[14px] border border-lt-200 bg-lt-50/60 p-4"><div className="flex items-center gap-3"><Mail size={18} className="text-brand"/><div className="min-w-0"><strong className="block truncate text-[.84rem] text-lt-900">Signed in as {user.name}</strong><span className="block truncate text-[.76rem] text-lt-500">{user.email}</span></div></div><Button type="button" onClick={accept} disabled={pending || !invitationId}>{pending ? 'Joining workspace…' : 'Accept invitation'}{!pending && <ArrowRight size={17}/>}</Button></div> : <div className="flex flex-wrap gap-2"><Link href={`/sign-in?next=${encodeURIComponent(destination)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-transparent bg-[linear-gradient(135deg,#1c9eec,#16429b)] px-[19px] text-[.95rem] font-[650] text-white no-underline">Sign in to accept<ArrowRight size={17}/></Link><Link href={`/sign-up?next=${encodeURIComponent(destination)}`} className="inline-flex min-h-12 items-center justify-center rounded-control border border-lt-200 bg-white px-[19px] text-[.95rem] font-[650] text-lt-900 no-underline hover:bg-lt-50">Create account</Link></div>}
  </section>
}
