'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import { apiRequest } from '../../lib/api-client'
import { controlClass, labelClass, lifecycles, stages, type Contact, type Deal, type Person } from '../../lib/crm'
import { Button } from '../ui/button'
import { Field } from '../ui/form-field'
import { FormMessage } from '../ui/form-message'

export const text = (data: FormData, key: string) => String(data.get(key) || '').trim()
export function MutationForm({ children, save, action, onSaved, reset = true }: { children: ReactNode; save: (data: FormData) => Promise<unknown>; action: string; onSaved?: () => void; reset?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget
    setPending(true); setError(''); setSuccess(false)
    try { await save(new FormData(form)); if (reset) form.reset(); setSuccess(true); router.refresh(); onSaved?.() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save changes') }
    finally { setPending(false) }
  }
  return <form className="grid gap-4" onSubmit={submit}><fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0">{children}</fieldset>{error && <FormMessage tone="error" role="alert">{error}</FormMessage>}{success && <FormMessage tone="success" role="status">Saved.</FormMessage>}<div className="flex justify-end pt-1 max-[560px]:[&>button]:w-full"><Button disabled={pending} type="submit">{pending ? 'Saving…' : action}</Button></div></form>
}
export function OwnerField({ members, owner }: { members: Person[]; owner?: Person | null }) {
  // A former member stays selectable so saving other fields doesn't silently unassign the record.
  return <label className={labelClass}>Owner<select className={controlClass} name="ownerId" defaultValue={owner?.id ?? ''}><option value="">Unassigned</option>{owner && !members.some((member) => member.id === owner.id) && <option value={owner.id}>{owner.name} (former member)</option>}{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
}
export function ContactForm({ contact, members, onSaved }: { contact?: Contact; members: Person[]; onSaved?: () => void }) {
  const router = useRouter()
  return <MutationForm reset={false} action={contact ? 'Save contact' : 'Create contact'} onSaved={onSaved} save={async (form) => {
    const saved = await apiRequest<Contact>(contact ? `/crm/contacts/${contact.id}` : '/crm/contacts', { method: contact ? 'PATCH' : 'POST', body: JSON.stringify({ name: text(form, 'name'), email: text(form, 'email') || undefined, companyName: text(form, 'companyName'), companyDomain: text(form, 'companyDomain'), jobTitle: text(form, 'jobTitle'), phone: text(form, 'phone'), ownerId: text(form, 'ownerId'), lifecycle: text(form, 'lifecycle') }) })
    if (!contact) router.push(`/dashboard/contacts/${saved.id}`)
  }}>
    <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
      <Field data-autofocus name="name" label="Full name" minLength={2} maxLength={120} defaultValue={contact?.name} required/>
      <Field name="email" label="Email" type="email" maxLength={254} defaultValue={contact?.email ?? ''}/>
      <Field name="companyName" label="Company" maxLength={160} defaultValue={contact?.companyName ?? ''}/>
      <Field name="companyDomain" label="Company domain" maxLength={253} defaultValue={contact?.companyDomain ?? ''}/>
      <Field name="jobTitle" label="Job title" maxLength={120} defaultValue={contact?.jobTitle ?? ''}/>
      <Field name="phone" label="Phone" type="tel" maxLength={50} defaultValue={contact?.phone ?? ''}/>
      <OwnerField members={members} owner={contact?.owner}/>
      <label className={labelClass}>Lifecycle<select className={`${controlClass} capitalize`} name="lifecycle" defaultValue={contact?.lifecycle ?? 'lead'}>{lifecycles.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
  </MutationForm>
}
export function DealForm({ prospectId, members, deal, onSaved }: { prospectId: string; members: Person[]; deal?: Deal; onSaved?: () => void }) {
  return <MutationForm action={deal ? 'Save deal' : 'Create deal'} onSaved={onSaved} save={(form) => apiRequest(deal ? `/crm/deals/${deal.id}` : '/crm/deals', { method: deal ? 'PATCH' : 'POST', body: JSON.stringify({ prospectId, title: text(form, 'title'), value: Number(text(form, 'value')), currency: text(form, 'currency'), stage: text(form, 'stage'), ownerId: text(form, 'ownerId'), expectedCloseAt: text(form, 'expectedCloseAt') || undefined }) })}>
    <Field data-autofocus name="title" label="Deal name" defaultValue={deal?.title} minLength={2} maxLength={160} required/>
    <div className="grid grid-cols-2 gap-4"><Field name="value" label="Value" type="number" step="0.01" min="0" max="999999999999.99" defaultValue={deal?.value ?? '0'} required/><Field name="currency" label="Currency (ISO code)" pattern="[A-Z]{3}" minLength={3} maxLength={3} defaultValue={deal?.currency ?? 'USD'} required/></div>
    <label className={labelClass}>Stage<select name="stage" className={`${controlClass} capitalize`} defaultValue={deal?.stage ?? 'new'}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
    <Field name="expectedCloseAt" label="Expected close" type="date" defaultValue={deal?.expectedCloseAt?.slice(0, 10)}/>
    <OwnerField members={members} owner={deal?.owner}/>
  </MutationForm>
}
export function NoteForm({ id, onSaved }: { id: string; onSaved?: () => void }) {
  return <MutationForm action="Add note" onSaved={onSaved} save={(data) => apiRequest(`/crm/contacts/${id}/notes`, { method: 'POST', body: JSON.stringify({ body: text(data, 'body') }) })}><label className={labelClass}>Conversation note<textarea data-autofocus name="body" className={`${controlClass} min-h-28 resize-y leading-relaxed`} maxLength={8000} required/></label></MutationForm>
}
export function TaskForm({ id, members, onSaved }: { id: string; members: Person[]; onSaved?: () => void }) {
  return <MutationForm action="Add follow-up" onSaved={onSaved} save={(form) => apiRequest('/crm/tasks', { method: 'POST', body: JSON.stringify({ prospectId: id, title: text(form, 'title'), dueAt: new Date(text(form, 'dueAt')).toISOString(), ownerId: text(form, 'ownerId') }) })}>
    <Field data-autofocus name="title" label="Next action" minLength={2} maxLength={200} required/><Field name="dueAt" label="Due date and time (your local time)" type="datetime-local" required/><OwnerField members={members}/>
  </MutationForm>
}
