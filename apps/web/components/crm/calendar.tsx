'use client'
import { LocalTime } from './local-time'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '../../lib/api-client'
import { cardClass, type CalendarStatus, type Meeting } from '../../lib/crm'
import { Button } from '../ui/button'
import { Field } from '../ui/form-field'
import { MutationForm, text } from './forms'

export function CalendarConnection({ status, result }: { status: CalendarStatus; result?: string }) {
  const router = useRouter(), [pending, setPending] = useState(false), [error, setError] = useState('')
  async function action() {
    setPending(true); setError('')
    try {
      if (status.connected) { await apiRequest('/crm/calendar', { method: 'DELETE' }); router.refresh() }
      else { const { url } = await apiRequest<{ url: string }>('/crm/calendar/connect', { method: 'POST' }); window.location.assign(url) }
    } catch (error) { setError(error instanceof Error ? error.message : 'Calendar connection failed') }
    finally { setPending(false) }
  }
  return <section className={`${cardClass} grid gap-4`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mt-0 mb-1 text-xs text-lt-500">Optional integration</p><h2 className="m-0 text-lg text-lt-900">Google Calendar</h2></div><span className="rounded-full bg-lt-100 px-3 py-1 text-xs text-brand">{status.connected ? 'Connected' : status.configured ? 'Ready to connect' : 'Not enabled'}</span></div><p className="m-0 text-sm leading-relaxed text-lt-600">Schedule a meeting from a contact and save it to your primary Google Calendar. Choose whether to email the contact an invitation. Each member connects their own account.</p>{!status.configured && <p className="m-0 rounded-xl bg-lt-50 p-4 text-sm leading-relaxed text-lt-600">Ask your workspace administrator to enable Calendar scheduling. You can use contacts, deals, notes, and follow-ups without connecting a calendar.</p>}{result && <p role="status" className={`m-0 text-sm ${result === 'connected' ? 'text-brand' : 'text-danger'}`}>{result === 'connected' ? 'Your Calendar is connected.' : result === 'cancelled' ? 'Calendar access was cancelled. You can connect whenever you’re ready.' : 'Calendar could not be connected. Try again from the same workspace.'}</p>}{error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}<div className="flex flex-wrap gap-3"><Button variant={status.connected ? 'secondary' : 'primary'} disabled={pending || (!status.configured && !status.connected)} onClick={action}>{pending ? 'Working…' : status.connected ? 'Disconnect Calendar' : 'Connect Google Calendar'}</Button><Link href="/dashboard/contacts" className="inline-flex items-center text-sm font-semibold text-brand">{status.connected ? 'Choose a contact to schedule →' : 'Continue to contacts →'}</Link></div>{status.connected && <p className="m-0 text-xs text-lt-500">Disconnecting leaves your existing events in Google Calendar.</p>}</section>
}
export function MeetingForm({ prospectId, hasEmail, status, onSaved, onUseFollowUp }: { prospectId: string; hasEmail: boolean; status: CalendarStatus; onSaved?: () => void; onUseFollowUp?: () => void }) {
  const [request, setRequest] = useState<{ payload: string; id: string } | null>(null)
  if (!status.connected || !status.configured) return <div className="grid justify-items-start gap-4"><p className="m-0 text-sm leading-relaxed text-lt-600">{status.configured ? 'Connect your Google Calendar to create events and optionally invite this contact.' : 'Calendar scheduling isn’t enabled yet. Add a follow-up with a date and time to keep the meeting on your radar.'}</p>{status.configured && <Link className="font-semibold text-brand" href="/dashboard/integrations">Connect Google Calendar →</Link>}{onUseFollowUp && <Button variant="secondary" onClick={onUseFollowUp}>Plan a follow-up instead</Button>}</div>
  return <MutationForm action="Schedule meeting" onSaved={onSaved} save={async (form) => {
    if (new Date(text(form, 'endsAt')).getTime() <= new Date(text(form, 'startsAt')).getTime()) throw new Error('Choose an end time after the meeting starts.')
    const payload = { prospectId, title: text(form, 'title'), startsAt: new Date(text(form, 'startsAt')).toISOString(), endsAt: new Date(text(form, 'endsAt')).toISOString(), inviteContact: form.get('inviteContact') === 'on' }
    const serialized = JSON.stringify(payload)
    const id = request?.payload === serialized ? request.id : crypto.randomUUID()
    setRequest({ payload: serialized, id })
    await apiRequest('/crm/calendar/meetings', { method: 'POST', body: JSON.stringify({ ...payload, id }) })
    setRequest(null)
  }}><p className="m-0 text-sm text-lt-600">Save this meeting to your primary Google Calendar. All times below use your local timezone.</p><Field name="title" label="Meeting title" minLength={2} maxLength={200} required/><div className="grid gap-3"><Field name="startsAt" label="Starts (your local time)" type="datetime-local" required/><Field name="endsAt" label="Ends (your local time)" type="datetime-local" required/></div><label className="flex items-start gap-3 text-sm text-lt-700"><input name="inviteContact" type="checkbox" className="mt-1 accent-brand" disabled={!hasEmail}/><span>Email a calendar invitation to this contact{!hasEmail ? ' (add an email first)' : ''}. Leave unchecked to create a private planning event.</span></label></MutationForm>
}
export function MeetingList({ meetings, userId }: { meetings: Meeting[]; userId: string }) {
  const router = useRouter(), [pending, setPending] = useState(false), [error, setError] = useState('')
  return <div className="grid gap-3">{error && <p role="alert" className="text-sm text-danger">{error}</p>}{meetings.map((meeting) => <article className="rounded-xl border border-lt-200 p-4" key={meeting.id}><h3 className="mt-0 mb-1 text-sm text-lt-900">{meeting.title}</h3><p className="m-0 text-xs text-lt-500"><LocalTime value={meeting.startsAt}/> · {meeting.status === 'synced' ? 'Scheduled' : 'Awaiting confirmation'}{meeting.inviteContact ? meeting.status === 'synced' ? ' · Contact invited' : ' · Invitation requested' : ' · Private event'}</p>{meeting.htmlLink && <a className="mt-2 inline-block text-xs text-brand" href={meeting.htmlLink} target="_blank" rel="noreferrer">Open in Google Calendar</a>}{meeting.status !== 'synced' && meeting.organizerId === userId && <Button variant="secondary" size="xs" className="mt-3" disabled={pending} onClick={async () => {
    setPending(true); setError('')
    try { await apiRequest('/crm/calendar/meetings', { method: 'POST', body: JSON.stringify({ id: meeting.id, prospectId: meeting.prospectId, title: meeting.title, startsAt: meeting.startsAt, endsAt: meeting.endsAt, inviteContact: meeting.inviteContact }) }); router.refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Meeting retry failed') }
    finally { setPending(false) }
  }}>Retry confirmation</Button>}</article>)}{!meetings.length && <p className="text-sm text-lt-500">No meetings scheduled from Lead Trace yet.</p>}</div>
}
