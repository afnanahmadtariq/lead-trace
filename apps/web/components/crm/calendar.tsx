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
  return <section className={`${cardClass} grid gap-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg text-lt-900">Google Calendar</h2><span className="rounded-full bg-lt-100 px-3 py-1 text-xs text-brand">{status.connected ? 'Connected' : status.configured ? 'Ready to connect' : 'Setup required'}</span></div><p className="m-0 text-sm leading-relaxed text-lt-600">Connect your Google account to schedule contact meetings in your primary calendar. Each workspace member connects their own account. Invitations are optional when scheduling.</p>{!status.configured && <p className="m-0 text-sm text-lt-500">Calendar is awaiting server configuration. Your workspace administrator can follow the Calendar setup instructions in the project README.</p>}{result && <p role="status" className={`m-0 text-sm ${result === 'connected' ? 'text-brand' : 'text-danger'}`}>{result === 'connected' ? 'Your Calendar is connected.' : result === 'cancelled' ? 'Calendar access was cancelled.' : 'Calendar could not be connected. Try again from the same workspace.'}</p>}{error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}<div><Button variant={status.connected ? 'secondary' : 'primary'} disabled={pending || (!status.configured && !status.connected)} onClick={action}>{pending ? 'Working…' : status.connected ? 'Disconnect Calendar' : 'Connect Google Calendar'}</Button></div>{status.connected && <p className="m-0 text-xs text-lt-500">Disconnect removes stored credentials. Existing events stay in Google Calendar. You can also revoke Lead Trace access in your Google account settings.</p>}</section>
}
export function MeetingForm({ prospectId, hasEmail, status }: { prospectId: string; hasEmail: boolean; status: CalendarStatus }) {
  const [request, setRequest] = useState<{ payload: string; id: string } | null>(null)
  if (!status.connected || !status.configured) return <p className="text-sm text-lt-600"><Link className="text-brand" href="/dashboard/integrations">Connect Google Calendar</Link> to schedule a meeting.</p>
  return <MutationForm action="Schedule meeting" save={async (form) => {
    const payload = { prospectId, title: text(form, 'title'), startsAt: new Date(text(form, 'startsAt')).toISOString(), endsAt: new Date(text(form, 'endsAt')).toISOString(), inviteContact: form.get('inviteContact') === 'on' }
    const serialized = JSON.stringify(payload)
    const id = request?.payload === serialized ? request.id : crypto.randomUUID()
    setRequest({ payload: serialized, id })
    await apiRequest('/crm/calendar/meetings', { method: 'POST', body: JSON.stringify({ ...payload, id }) })
    setRequest(null)
  }}><Field name="title" label="Meeting title" minLength={2} maxLength={200} required/><div className="grid gap-3"><Field name="startsAt" label="Starts (your local time)" type="datetime-local" required/><Field name="endsAt" label="Ends (your local time)" type="datetime-local" required/></div><label className="flex items-start gap-3 text-sm text-lt-700"><input name="inviteContact" type="checkbox" className="mt-1 accent-brand" disabled={!hasEmail}/><span>Email a calendar invitation to this contact{!hasEmail ? ' (add an email first)' : ''}. Leave unchecked to create a private planning event.</span></label></MutationForm>
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
