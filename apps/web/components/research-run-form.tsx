'use client'

import { ArrowRight, BriefcaseBusiness, Building2, Link2, Mail, MessageSquareText, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import { apiRequest } from '../lib/api-client'
import type { ResearchRunSummary } from '../lib/research'
import { Button } from './ui/button'
import { Field } from './ui/form-field'
import { FormMessage } from './ui/form-message'

export type OfferDefaults = {
  name: string
  valueProposition: string
  targetPersona?: string | null
}

export function ResearchRunForm({ initialOffer }: { initialOffer?: OfferDefaults }) {
  const router = useRouter()
  const [goal, setGoal] = useState<'meeting' | 'outreach'>('meeting')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const optional = (name: string) => String(form.get(name) || '').trim() || undefined

    try {
      const run = await apiRequest<ResearchRunSummary>('/research-runs', {
        method: 'POST',
        body: JSON.stringify({
          prospectName: optional('prospectName'),
          prospectEmail: optional('prospectEmail'),
          companyName: optional('companyName'),
          companyDomain: optional('companyDomain'),
          linkedinUrl: optional('linkedinUrl'),
          xHandle: optional('xHandle'),
          offerName: optional('offerName'),
          offerContext: optional('offerContext'),
          targetPersona: optional('targetPersona'),
          goal,
        }),
      })

      if (run.status === 'queued') {
        await apiRequest(`/research-runs/${run.id}/discover`, { method: 'POST' }).catch(() => undefined)
      }
      router.push(`/dashboard/research/${run.id}`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start prospect research')
      setPending(false)
    }
  }

  const cardClass = 'rounded-[18px] border border-lt-200 bg-white p-6 shadow-card max-[700px]:p-5'
  const gridClass = 'grid grid-cols-2 gap-4 max-[700px]:grid-cols-1'
  const labelClass = 'col-span-full grid gap-2 text-sm font-semibold text-lt-700'
  const controlClass = 'w-full rounded-xl border border-lt-300 bg-white px-3.5 py-3 text-lt-950 outline-none transition focus:border-brand-bright focus:ring-3 focus:ring-brand-bright/10'

  return <form className="grid gap-4" onSubmit={submit}>
    <section className={cardClass}>
      <FormSectionHeader icon={<MessageSquareText/>} title="What do you need?" description="Choose the output you will use next."/>
      <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
        <GoalOption value="meeting" selected={goal === 'meeting'} title="Prepare for a meeting" description="Why now, talk track, questions, objections" onSelect={setGoal}/>
        <GoalOption value="outreach" selected={goal === 'outreach'} title="Write personalized outreach" description="Relevant angle, opener, email draft, next step" onSelect={setGoal}/>
      </div>
    </section>

    <section className={cardClass}>
      <FormSectionHeader icon={<UsersRound/>} title="Add the prospect" description="Name and company are enough to start. Add a domain or LinkedIn URL for sharper matching."/>
      <div className={gridClass}>
        <Field id="prospect-name" name="prospectName" label="Prospect name" placeholder="Maya Chen" required/>
        <Field id="company-name" name="companyName" label="Company" placeholder="Northstar Labs" required icon={<Building2 size={18}/>}/>
        <Field id="company-domain" name="companyDomain" label="Company domain" placeholder="northstar.com"/>
        <Field id="linkedin-url" name="linkedinUrl" type="url" label="LinkedIn profile" placeholder="https://linkedin.com/in/…" icon={<Link2 size={18}/>}/>
      </div>
      <details className="mt-4 rounded-xl border border-lt-200 bg-lt-50/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-lt-700">Add email or social handle</summary>
        <div className={`${gridClass} mt-4`}>
          <Field id="prospect-email" name="prospectEmail" type="email" label="Work email" placeholder="maya@company.com" icon={<Mail size={18}/>}/>
          <Field id="x-handle" name="xHandle" label="X handle" placeholder="@mayachen"/>
        </div>
      </details>
    </section>

    <section className={cardClass}>
      <FormSectionHeader icon={<BriefcaseBusiness/>} title="Connect your offer" description={initialOffer ? 'Reusing your latest offer—edit only what changed.' : 'Give Lead Trace enough context to connect signals to a credible outcome.'}/>
      <div className={gridClass}>
        <Field id="offer-name" name="offerName" label="Offer" placeholder="Enterprise analytics platform" defaultValue={initialOffer?.name} required/>
        <Field id="target-persona" name="targetPersona" label="Best-fit buyer" placeholder="VP Sales at B2B SaaS" defaultValue={initialOffer?.targetPersona || ''}/>
        <label className={labelClass}><span>Problem you solve and outcome you create</span><textarea className={`${controlClass} min-h-[112px] resize-y leading-relaxed`} name="offerContext" minLength={20} maxLength={4000} defaultValue={initialOffer?.valueProposition} placeholder="We help revenue teams cut prospect research time and enter every conversation with evidence-backed relevance…" required/></label>
      </div>
    </section>

    {error && <FormMessage tone="error" className="text-[.8rem]">{error}</FormMessage>}
    <div className="sticky bottom-4 z-2 flex items-center justify-between gap-4 rounded-2xl border border-lt-200 bg-white/94 p-3 shadow-panel backdrop-blur-xl max-[620px]:items-stretch">
      <p className="m-0 pl-2 text-xs leading-normal text-lt-500 max-[620px]:hidden">Research starts immediately. Key signals link back to their sources.</p>
      <Button className="min-w-[220px] max-[620px]:w-full" type="submit" disabled={pending}>{pending ? 'Starting research…' : goal === 'meeting' ? 'Build meeting brief' : 'Build outreach draft'}{!pending && <ArrowRight size={18}/>}</Button>
    </div>
  </form>
}

function GoalOption({ value, selected, title, description, onSelect }: { value: 'meeting' | 'outreach'; selected: boolean; title: string; description: string; onSelect: (value: 'meeting' | 'outreach') => void }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-[15px] border p-4 transition ${selected ? 'border-brand-bright bg-lt-100 shadow-card' : 'border-lt-200 bg-white hover:border-lt-300'}`}>
    <input className="mt-1 size-4 accent-brand" type="radio" name="goal" value={value} checked={selected} onChange={() => onSelect(value)}/>
    <span><strong className="block text-sm text-lt-900">{title}</strong><small className="mt-1 block text-xs leading-normal text-lt-500">{description}</small></span>
  </label>
}

function FormSectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <header className="mb-5 flex gap-3 text-brand-bright"><span>{icon}</span><div><h2 className="m-0 text-lg text-lt-900">{title}</h2><p className="mt-1 mb-0 text-sm text-lt-600">{description}</p></div></header>
}
