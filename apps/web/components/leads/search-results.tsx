'use client'
import { ArrowUpRight, Check, LoaderCircle, Search, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest } from '../../lib/api-client'
import { cardClass, controlClass, label, type ContactPage, type Person } from '../../lib/crm'
import type { LeadCandidate, LeadCapabilities, LeadSearchDetail } from '../../lib/leads'
import { MutationForm, OwnerField, text } from '../crm/forms'
import { LocalTime } from '../crm/local-time'
import { Button, ButtonLink } from '../ui/button'
import { Field } from '../ui/form-field'
import { Modal } from '../ui/modal'

const filters = ['all', 'new', 'qualified', 'converted', 'dismissed'] as const
const statusLabel = (value: string) => value === 'converted' ? 'Saved to CRM' : label(value)

export function LeadSearchResults({ search, members, capabilities }: { search: LeadSearchDetail; members: Person[]; capabilities: LeadCapabilities }) {
  const router = useRouter(), started = useRef(false)
  const [filter, setFilter] = useState<typeof filters[number]>('all'), [busy, setBusy] = useState(''), [error, setError] = useState(''), [selected, setSelected] = useState<LeadCandidate | null>(null)
  const ready = capabilities.discoveryConfigured && capabilities.extractionConfigured
  const expired = Boolean(search.interrupted)
  const retryable = (search.status === 'failed' || expired) && search.attemptCount < 5
  async function discover() {
    setError(''); setBusy('discover')
    try { await apiRequest(`/leads/searches/${search.id}/discover`, { method: 'POST' }) }
    catch (error) { if (!(error instanceof ApiError && error.status === 409)) setError(error instanceof Error ? error.message : 'Search failed') }
    finally { setBusy(''); router.refresh() }
  }
  useEffect(() => {
    if (search.status !== 'queued' || started.current || !ready) return
    started.current = true
    void apiRequest(`/leads/searches/${search.id}/discover`, { method: 'POST' }).catch((error) => {
      if (!(error instanceof ApiError && error.status === 409)) setError(error instanceof Error ? error.message : 'Search failed')
    }).finally(() => router.refresh())
  }, [search.id, search.status, ready, router])
  useEffect(() => {
    if (!['queued', 'running'].includes(search.status)) return
    const timer = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(timer)
  }, [search.status, router])
  async function review(candidate: LeadCandidate, status: string) {
    setBusy(candidate.id); setError('')
    try { await apiRequest(`/leads/candidates/${candidate.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); router.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not review lead') }
    finally { setBusy('') }
  }
  const candidates = search.candidates.filter((candidate) => filter === 'all' || candidate.status === filter)
  return <>
    <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}><div><span className="inline-flex items-center gap-2 text-sm font-semibold text-brand">{['queued', 'running'].includes(search.status) ? <LoaderCircle className="animate-spin" size={17}/> : <Search size={17}/>} {label(search.status)}</span><p className="mt-2 mb-0 text-xs text-lt-500">{search.sources.length} source pages · {search.candidates.length} suggested leads · Attempt {search.attemptCount}/5</p></div><div className="flex flex-wrap gap-2">{retryable && <Button onClick={discover} disabled={Boolean(busy) || !ready}>Retry search</Button>}{['queued', 'running', 'failed'].includes(search.status) && <Button variant="secondary" disabled={busy === 'cancel'} onClick={async () => {
      setBusy('cancel'); setError('')
      try { await apiRequest(`/leads/searches/${search.id}/cancel`, { method: 'POST' }); router.refresh() }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not cancel search') }
      finally { setBusy('') }
    }}>Cancel search</Button>}<ButtonLink href="/dashboard/leads" variant="secondary">New search</ButtonLink></div></div>
    {!ready && ['queued', 'running', 'failed'].includes(search.status) && <p role="status" className="text-sm text-lt-600">The discovery providers need server configuration before this search can run.</p>}
    {(error || search.errorMessage) && <p role="alert" className="rounded-xl border border-danger/20 bg-white p-4 text-sm text-danger">{error || search.errorMessage}</p>}
    {expired && <p role="status" className="text-sm text-lt-600">This search was interrupted. Retry to safely start a new attempt.</p>}
    {search.failedQueries > 0 && <p className="text-sm text-lt-600">{search.failedQueries} of 3 discovery queries failed. These results cover the successful queries only.</p>}
    {search.status === 'completed' && <>
      <div className="flex flex-wrap gap-2" aria-label="Filter leads">{filters.map((value) => <Button size="xs" variant={filter === value ? 'primary' : 'secondary'} key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : statusLabel(value)} · {value === 'all' ? search.candidates.length : search.candidates.filter((candidate) => candidate.status === value).length}</Button>)}</div>
      <p className="m-0 text-xs leading-relaxed text-lt-500">Source coverage shows which requested terms appear in the quoted context. It does not verify company size, current employment, budget, or intent. Open the original page before qualifying a lead.</p>
      <div className="grid grid-cols-2 items-start gap-4 max-[1100px]:grid-cols-1">{candidates.map((candidate) => <article key={candidate.id} className={`${cardClass} grid min-w-0 gap-4`}>
        <header className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-xl text-lt-900">{candidate.name}</h2><p className="mt-1 mb-0 text-sm text-lt-600">{candidate.jobTitle ? `${candidate.jobTitle} · ` : ''}{candidate.companyName}</p></div><span className="shrink-0 rounded-full bg-lt-100 px-3 py-1 text-xs text-brand">{statusLabel(candidate.status)}</span></header>
        <div className="grid gap-2"><p className="m-0 text-xs font-semibold text-lt-700">Source coverage · {candidate.matchedCriteria.length}/{candidate.matchedCriteria.length + candidate.missingCriteria.length} criteria</p><div className="flex flex-wrap gap-2">{candidate.matchedCriteria.map((key) => <span className="inline-flex items-center gap-1 rounded-full bg-lt-100 px-2 py-1 text-xs text-brand" key={key}><Check size={12}/>{label(key)}</span>)}</div>{candidate.missingCriteria.length > 0 && <p className="m-0 text-xs text-lt-500">Unconfirmed in this quote: {candidate.missingCriteria.map(label).join(', ')}.</p>}</div>
        <blockquote className="m-0 border-l-2 border-brand/40 bg-lt-50 p-4 text-sm leading-relaxed break-words text-lt-700">“{candidate.quote}”</blockquote>
        <div><a className="inline-flex items-center gap-1 break-words text-sm font-semibold text-brand" href={candidate.source.url} target="_blank" rel="noreferrer">{candidate.source.title}<ArrowUpRight size={15}/></a><p className="mt-1 mb-0 text-xs text-lt-500">{candidate.source.publisher} · Retrieved <LocalTime value={candidate.source.retrievedAt} dateOnly/></p></div>
        <footer className="flex flex-wrap gap-2">{candidate.status === 'converted' && candidate.prospectId ? <ButtonLink href={`/dashboard/contacts/${candidate.prospectId}`}>Open CRM contact</ButtonLink> : <>
          {candidate.status !== 'qualified' && <Button size="xs" disabled={Boolean(busy)} onClick={() => review(candidate, 'qualified')}>Qualify lead</Button>}
          {candidate.status === 'qualified' && <Button size="xs" onClick={() => setSelected(candidate)}>Save to CRM</Button>}
          {candidate.status !== 'dismissed' ? <Button size="xs" variant="secondary" disabled={Boolean(busy)} onClick={() => review(candidate, 'dismissed')}>Dismiss</Button> : <Button size="xs" variant="secondary" disabled={Boolean(busy)} onClick={() => review(candidate, 'new')}>Restore</Button>}
        </>}</footer>
      </article>)}</div>
      {!candidates.length && <div className={`${cardClass} grid min-h-44 content-center justify-items-center gap-3 text-center`}><UsersRound size={28} className="text-brand"/><h2 className="m-0 text-lg text-lt-900">{search.candidates.length ? 'No leads in this view' : 'No supported leads found'}</h2><p className="m-0 max-w-lg text-sm text-lt-500">{search.candidates.length ? 'Choose another filter to review your shortlist.' : 'Try a broader role, industry, or location. Leads appear only when a source snippet supports the person and company.'}</p></div>}
    </>}
    {['queued', 'running'].includes(search.status) && <div className={`${cardClass} grid min-h-44 content-center justify-items-center gap-3 text-center`}><Search size={28} className="text-brand"/><h2 className="m-0 text-lg text-lt-900">Finding source-linked leads</h2><p className="m-0 max-w-lg text-sm text-lt-500">We are searching public pages and extracting supported identities. This page updates as the search completes.</p></div>}
    <details className={cardClass}><summary className="cursor-pointer text-sm font-semibold text-lt-700">Source pages · {search.sources.length}</summary><div className="mt-4 grid gap-3">{search.sources.map((source) => <article className="border-t border-lt-100 pt-3" key={source.id}><a className="text-sm font-semibold text-brand" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p className="mt-2 mb-0 whitespace-pre-wrap text-xs leading-relaxed break-words text-lt-500">{source.excerpt}</p></article>)}</div></details>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Review and save to CRM" description="Confirm the contact details. Matching CRM records are linked without overwriting existing data.">{selected && <ConvertLeadForm key={selected.id} candidate={selected} members={members}/>}</Modal>
  </>
}

function ConvertLeadForm({ candidate, members }: { candidate: LeadCandidate; members: Person[] }) {
  const router = useRouter(), [matches, setMatches] = useState<ContactPage['items']>([]), [lookupError, setLookupError] = useState('')
  useEffect(() => {
    let active = true
    void apiRequest<ContactPage>(`/crm/contacts?q=${encodeURIComponent(candidate.name)}`).then((data) => { if (active) setMatches(data.items) }).catch(() => { if (active) setLookupError('Existing contacts could not be loaded. Saving still checks for duplicates.') })
    return () => { active = false }
  }, [candidate.name])
  return <MutationForm action="Save reviewed lead" reset={false} save={async (form) => {
    const saved = await apiRequest<{ prospectId: string }>(`/leads/candidates/${candidate.id}/convert`, { method: 'POST', body: JSON.stringify({ name: text(form, 'name'), companyName: text(form, 'companyName'), jobTitle: text(form, 'jobTitle'), email: text(form, 'email') || undefined, companyDomain: text(form, 'companyDomain'), ownerId: text(form, 'ownerId'), lifecycle: 'qualified', existingContactId: text(form, 'existingContactId') || undefined }) })
    router.push(`/dashboard/contacts/${saved.prospectId}`)
  }}>
    <Field name="name" label="Full name" minLength={2} maxLength={120} defaultValue={candidate.name} required/>
    <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1"><Field name="companyName" label="Company" minLength={2} maxLength={160} defaultValue={candidate.companyName} required/><Field name="jobTitle" label="Job title" maxLength={120} defaultValue={candidate.jobTitle || ''}/></div>
    <Field name="email" label="Email (if independently known)" type="email" maxLength={254}/><Field name="companyDomain" label="Company domain (optional)" maxLength={253}/><OwnerField members={members}/>
    {matches.length > 0 && <label className="grid gap-2 text-sm font-semibold text-lt-700">Link an existing contact<select name="existingContactId" className={controlClass} defaultValue=""><option value="">Check for a matching contact automatically</option>{matches.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.companyName || contact.email || 'No company'}</option>)}</select></label>}
    {lookupError && <p className="m-0 text-xs text-lt-500">{lookupError}</p>}
    <p className="m-0 text-xs leading-relaxed text-lt-500">Emails are not guessed. The discovery quote stays attached to the CRM contact for review.</p>
  </MutationForm>
}
