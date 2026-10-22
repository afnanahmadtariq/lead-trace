'use client'
import { useRouter } from 'next/navigation'
import { apiRequest } from '../../lib/api-client'
import type { LeadCapabilities } from '../../lib/leads'
import { MutationForm, text } from '../crm/forms'
import { Field } from '../ui/form-field'

export function LeadSearchForm({ capabilities }: { capabilities: LeadCapabilities }) {
  const router = useRouter()
  if (!capabilities.discoveryConfigured || !capabilities.extractionConfigured) return <div className="rounded-xl bg-lt-50 p-4 text-sm leading-relaxed text-lt-600">Lead generation needs the web discovery and model providers configured on the API. Your administrator can follow the lead-generation setup in the project README.</div>
  return <MutationForm action="Find leads" reset={false} save={async (form) => {
    const created = await apiRequest<{ id: string }>('/leads/searches', { method: 'POST', body: JSON.stringify({ title: text(form, 'title'), industry: text(form, 'industry'), role: text(form, 'role'), location: text(form, 'location') || undefined, keywords: text(form, 'keywords') || undefined }) })
    router.push(`/dashboard/leads/${created.id}`)
  }}>
    <Field name="title" label="Search name" placeholder="London SaaS sales leaders" minLength={2} maxLength={100} required/>
    <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1"><Field name="industry" label="Industry or market" placeholder="B2B SaaS" minLength={2} maxLength={100} required/><Field name="role" label="Buyer role" placeholder="Head of Sales" minLength={2} maxLength={100} required/></div>
    <Field name="location" label="Location (optional)" placeholder="United Kingdom" maxLength={100}/>
    <Field name="keywords" label="Additional keywords (optional)" placeholder="Enterprise analytics" maxLength={100}/>
    <p className="m-0 text-xs leading-relaxed text-lt-500">Each search makes up to three web searches and one AI extraction request. Review the source quotes and any unconfirmed criteria before saving leads to CRM. Search results do not establish buying intent.</p>
  </MutationForm>
}
