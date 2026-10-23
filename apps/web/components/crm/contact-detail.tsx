'use client'
import { LocalTime } from './local-time'
import Link from 'next/link'
import { useState } from 'react'
import { cardClass, label, money, type CalendarStatus, type ContactDetail as Detail, type Person } from '../../lib/crm'
import { Button, ButtonLink } from '../ui/button'
import { Modal } from '../ui/modal'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection } from '../workspace/workspace-page'
import { MeetingForm, MeetingList } from './calendar'
import { ContactForm, DealForm, NoteForm, TaskForm } from './forms'
import { TaskList } from './task-list'

export function ContactDetail({ contact, members, calendar, userId }: { contact: Detail; members: Person[]; calendar: CalendarStatus; userId: string }) {
  const [edit, setEdit] = useState(false)
  return <WorkspacePage>
    <Link className="text-sm text-brand" href="/dashboard/contacts">← All contacts</Link>
    <WorkspaceHeader eyebrow={label(contact.lifecycle)} title={contact.name} lead={[contact.jobTitle, contact.companyName].filter(Boolean).join(' · ') || 'Your next relationship starts here.'} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setEdit(true)}>Edit contact</Button><ButtonLink href={`/dashboard/research/new?contact=${contact.id}`}>Research contact</ButtonLink></div>}/>
    <div className={`${cardClass} flex flex-wrap gap-x-8 gap-y-3 text-sm text-lt-600`}><span>{contact.email || 'No email'}</span><span>{contact.phone || 'No phone'}</span><span>{contact.companyDomain || 'No company domain'}</span><span>Owner: {contact.owner?.name || 'Unassigned'}</span></div>
    <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
      <div className="grid gap-6">
        <WorkspaceSection title="Deals" description="Track the opportunity and its next stage." action={<Link href="/dashboard/pipeline">View pipeline</Link>}><div className={`${cardClass} grid gap-4`}>{contact.deals.map((deal) => <article key={deal.id} className="border-b border-lt-100 pb-4"><Link href="/dashboard/pipeline" className="font-semibold text-brand">{deal.title}</Link><p className="mt-1 mb-0 text-sm text-lt-600">{label(deal.stage)} · {money(deal.value, deal.currency)}</p></article>)}<details><summary className="cursor-pointer text-sm font-semibold text-brand">Add deal</summary><div className="mt-4"><DealForm prospectId={contact.id} members={members}/></div></details></div></WorkspaceSection>
        <WorkspaceSection title="Conversation notes" description="Keep context close to the relationship."><div className={`${cardClass} grid gap-5`}><NoteForm id={contact.id}/>{contact.notes.map((note) => <article key={note.id} className="border-t border-lt-100 pt-4"><p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-lt-700">{note.body}</p><p className="mt-2 mb-0 text-xs text-lt-500">{note.author?.name || 'Former member'} · <LocalTime value={note.createdAt}/></p></article>)}</div></WorkspaceSection>
        <WorkspaceSection title="Research history" description="New research stays linked to this contact."><div className={`${cardClass} grid gap-3`}>{contact.researchRuns.map((run) => <Link key={run.id} className="rounded-xl border border-lt-200 p-4 text-sm text-brand" href={run.brief ? `/dashboard/briefs/${run.brief.id}` : `/dashboard/research/${run.id}`}><strong>{run.brief?.title || `${label(run.goal)} research`}</strong><small className="mt-1 block text-lt-500">{label(run.status)} · <LocalTime value={run.requestedAt} dateOnly/></small></Link>)}{!contact.researchRuns.length && <p className="m-0 text-sm text-lt-500">No research yet. Add a company or domain, then research this contact.</p>}</div></WorkspaceSection>
      </div>
      <div className="grid gap-6">
        <WorkspaceSection title="Follow-ups" description="Every conversation needs a next action."><TaskList tasks={contact.tasks}/><details className={cardClass}><summary className="cursor-pointer text-sm font-semibold text-brand">Add follow-up</summary><div className="mt-4"><TaskForm id={contact.id} members={members}/></div></details></WorkspaceSection>
        <WorkspaceSection title="Meetings" description="Schedule through your connected Google Calendar."><div className={`${cardClass} grid gap-5`}><MeetingList meetings={contact.meetings} userId={userId}/><details><summary className="cursor-pointer text-sm font-semibold text-brand">Schedule meeting</summary><div className="mt-4"><MeetingForm prospectId={contact.id} hasEmail={Boolean(contact.email)} status={calendar}/></div></details></div></WorkspaceSection>
      </div>
    </div>
    <p className="m-0 text-xs text-lt-500">History shows the latest 50 research runs and up to 100 notes, deals, follow-ups, and meetings.</p>
    <Modal open={edit} onClose={() => setEdit(false)} title="Edit contact"><ContactForm contact={contact} members={members} onSaved={() => setEdit(false)}/></Modal>
  </WorkspacePage>
}
