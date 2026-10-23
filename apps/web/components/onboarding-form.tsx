'use client'

import { ArrowRight, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import type { AccountContext } from '../lib/account-context'
import { authClient } from '../lib/auth-client'
import { Button } from './ui/button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

function slugFor(name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42) || 'workspace'
  return `${base}-${crypto.randomUUID().slice(0, 6)}`
}

export function OnboardingForm({ context }: { context: AccountContext }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function activate(organizationId: string) {
    setPending(true)
    setError('')
    const result = await authClient.organization.setActive({ organizationId })
    if (result.error) { setError(result.error.message || 'Could not select workspace'); setPending(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const name = String(new FormData(event.currentTarget).get('name') || '').trim()
    const result = await authClient.organization.create({ name, slug: slugFor(name) })
    if (result.error) { setError(result.error.message || 'Could not create workspace'); setPending(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return <div className="grid gap-5 rounded-[22px] border border-lt-200 bg-white p-7 shadow-panel max-[560px]:p-5">
    {context.workspaces.length > 0 && <section>
      <h2 className="mt-0 mb-3 text-sm tracking-wider text-lt-900 uppercase">Your workspaces</h2>
      {context.workspaces.map((workspace) => <Button type="button" variant="secondary" className="w-full justify-start! gap-3 bg-lt-50 p-3! text-left text-lt-900" key={workspace.id} onClick={() => activate(workspace.id)} disabled={pending}>
        <Building2 size={19}/><span className="grid flex-1 gap-0.5"><strong>{workspace.name}</strong><small className="text-lt-500 capitalize">{workspace.role}</small></span><ArrowRight size={17}/>
      </Button>)}
    </section>}
    <form className="grid gap-4" onSubmit={submit}><Field id="workspace-name" name="name" label="Workspace name" placeholder="Acme sales team" required maxLength={80}/>{error && <FormMessage tone="error">{error}</FormMessage>}<Button className="w-full" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create workspace'}<ArrowRight size={18}/></Button></form>
  </div>
}
