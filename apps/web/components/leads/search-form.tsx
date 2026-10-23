'use client'
import { useRouter } from 'next/navigation'
import { apiRequest } from '../../lib/api-client'
import type { LeadCapabilities } from '../../lib/leads'
import { MutationForm, text } from '../crm/forms'
import { Field } from '../ui/form-field'
import { controlClass } from '../../lib/crm'

export function LeadSearchForm({ capabilities }: { capabilities: LeadCapabilities }) {
  const router = useRouter()
  if (!capabilities.discoveryConfigured || !capabilities.extractionConfigured) return <div className="rounded-xl bg-lt-50 p-4 text-sm leading-relaxed text-lt-600">Lead generation needs the web discovery and model providers configured on the API. Your administrator can follow the lead-generation setup in the project README.</div>
  return <MutationForm action="Find leads" reset={false} save={async (form) => {
    const created = await apiRequest<{ id: string }>('/leads/searches', { method: 'POST', body: JSON.stringify({ title: text(form, 'title'), industry: text(form, 'industry'), role: text(form, 'role'), location: text(form, 'location') || undefined, keywords: text(form, 'keywords') || undefined, depth: text(form, 'depth'), roleMatch: form.get('relatedRoles') === 'on' ? 'function' : 'exact' }) })
    router.push(`/dashboard/leads/${created.id}`)
  }}>
    <Field name="title" label="Search name" placeholder="London SaaS sales leaders" minLength={2} maxLength={100} required/>
    <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1"><Field name="industry" label="Industry or market" placeholder="B2B SaaS" minLength={2} maxLength={100} required/><Field name="role" label="Buyer role" placeholder="Head of Sales" minLength={2} maxLength={100} required/></div>
    <Field name="location" label="Location (optional)" placeholder="United Kingdom" maxLength={100}/>
    <Field name="keywords" label="Additional keywords (optional)" placeholder="Enterprise analytics" maxLength={100}/>
    <label className="grid gap-2 text-sm font-semibold text-lt-700">Search depth<select name="depth" className={controlClass} defaultValue="deep"><option value="deep">Deep — companies, registries, teams and full pages</option><option value="quick">Quick — three web searches</option></select></label>
    <label className="flex items-start gap-3 text-sm text-lt-700"><input type="checkbox" name="relatedRoles" defaultChecked className="mt-1 accent-brand"/><span>Include equivalent senior roles<small className="mt-1 block text-xs leading-relaxed text-lt-500">For sales, this can include VP Sales, Sales Director, and Chief Revenue Officer. Each person keeps their actual title.</small></span></label>
    <p className="m-0 text-xs leading-relaxed text-lt-500">Deep discovery investigates up to eight companies with up to 30 searches, full-page extraction, and four bounded site crawls. It also checks public registries. It uses more provider credits and can take a few minutes; you can leave and return. Location evidence may describe a person’s work location or company headquarters. Review evidence before outreach.</p>
  </MutationForm>
}
