'use client'

import { ArrowLeft, ArrowRight, CalendarDays, CheckCheck, FileText, Mail, Phone, Plus, Search, StickyNote, Target, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { cardClass, label, money, type CalendarStatus, type ContactDetail as Detail, type Person } from '../../lib/crm'
import { Button, ButtonLink } from '../ui/button'
import { Modal } from '../ui/modal'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection } from '../workspace/workspace-page'
import { MeetingForm, MeetingList } from './calendar'
import { ContactForm, DealForm, NoteForm, TaskForm } from './forms'
import { LocalTime } from './local-time'
import { TaskList } from './task-list'

type Action = 'edit' | 'deal' | 'note' | 'task' | 'meeting'
const titles: Record<Action, string> = { edit: 'Edit contact', deal: 'Add deal', note: 'Add note', task: 'Add follow-up', meeting: 'Schedule meeting' }

export function ContactDetail({ contact, members, calendar, userId }: { contact: Detail; members: Person[]; calendar: CalendarStatus; userId: string }) {
  const [action, setAction] = useState<Action | null>(null)
  const close = () => setAction(null)
  const openTasks = contact.tasks.filter((task) => !task.completedAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const completedTasks = contact.tasks.filter((task) => task.completedAt)
  const nextTask = openTasks[0]
  const openDeals = contact.deals.filter((deal) => !['won', 'lost'].includes(deal.stage))

  return <WorkspacePage>
    <Link className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-lt-600 hover:text-brand" href="/dashboard/contacts"><ArrowLeft size={15}/>All contacts</Link>
    <WorkspaceHeader eyebrow={label(contact.lifecycle)} title={contact.name} lead={[contact.jobTitle, contact.companyName].filter(Boolean).join(' · ') || 'Add context as the relationship develops.'} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setAction('edit')}>Edit contact</Button><ButtonLink href={`/dashboard/research/new?contact=${contact.id}`}><Search size={16}/>Research contact</ButtonLink></div>}/>

    <div className={`${cardClass} grid gap-5`}>
      <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-lt-600">
        {contact.email && <a className="inline-flex items-center gap-2 break-all hover:text-brand" href={`mailto:${contact.email}`}><Mail size={15} className="shrink-0"/>{contact.email}</a>}
        {contact.phone && <a className="inline-flex items-center gap-2 hover:text-brand" href={`tel:${contact.phone}`}><Phone size={15}/>{contact.phone}</a>}
        <span className="inline-flex items-center gap-2"><UserRound size={15}/>Owner: {contact.owner?.name || 'Unassigned'}</span>
        {contact.companyDomain && <span className="break-all">{contact.companyDomain}</span>}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-lt-100 pt-4 max-[560px]:grid max-[560px]:grid-cols-2 max-[560px]:[&>button]:px-2 max-[560px]:[&>button]:text-xs" aria-label="Contact actions">
        <Button size="sm" onClick={() => setAction('task')}><Plus size={16}/>Add follow-up</Button>
        <Button size="sm" variant="secondary" onClick={() => setAction('deal')}><Target size={16}/>Add deal</Button>
        <Button size="sm" variant="secondary" onClick={() => setAction('note')}><StickyNote size={16}/>Add note</Button>
        <Button size="sm" variant="ghost" onClick={() => setAction('meeting')}><CalendarDays size={16}/>Schedule meeting</Button>
      </div>
    </div>

    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,.8fr)] items-start gap-6 max-[900px]:grid-cols-1">
      <div className="grid min-w-0 gap-6 max-[900px]:contents">
        <section className="rounded-2xl border border-brand/20 bg-lt-100/70 p-5 max-[900px]:order-0" aria-label="Next step">
          <p className="mt-0 mb-2 flex items-center gap-2 text-xs font-semibold text-brand"><CheckCheck size={17}/>NEXT STEP</p>
          <h2 className="m-0 break-words text-xl tracking-tight text-lt-900">{nextTask?.title || 'Give this relationship a next step'}</h2>
          <p className="mt-2 mb-4 text-sm leading-relaxed text-lt-600">{nextTask ? <>Due <LocalTime value={nextTask.dueAt}/> · {nextTask.owner?.name || 'Unassigned'}</> : 'After a conversation, capture what you agreed to do and when. A follow-up keeps it from slipping.'}</p>
          {nextTask ? <Link href="#contact-follow-ups" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">View follow-ups<ArrowRight size={15}/></Link> : <Button size="xs" onClick={() => setAction('task')}>Set a next step<ArrowRight size={15}/></Button>}
        </section>

        {Boolean(contact.leadCandidates?.length) && <div className="max-[900px]:order-2"><WorkspaceSection title="Lead discovery" description="Source context preserved from your reviewed shortlist."><div className={`${cardClass} grid gap-4`}>{contact.leadCandidates?.map((lead) => <article key={lead.id}><Link className="text-sm font-semibold text-brand" href={`/dashboard/leads/${lead.search.id}`}>{lead.search.title}</Link><blockquote className="my-3 border-l-2 border-lt-200 pl-3 text-sm leading-relaxed text-lt-600">{lead.quote}</blockquote><a className="text-xs text-brand" href={lead.source.url} target="_blank" rel="noreferrer">{lead.source.title} ↗</a></article>)}</div></WorkspaceSection></div>}

        <div className="max-[900px]:order-2"><WorkspaceSection title="Deals" description={`${openDeals.length} open ${openDeals.length === 1 ? 'opportunity' : 'opportunities'} with this contact.`} action={<Link href="/dashboard/pipeline">View pipeline →</Link>}>
          <div className={`${cardClass} grid gap-3`}>
            {contact.deals.map((deal) => <article key={deal.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lt-100 p-4"><div><Link href="/dashboard/pipeline" className="font-semibold text-brand">{deal.title}</Link><p className="mt-1 mb-0 text-xs text-lt-600">{label(deal.stage)}{deal.owner ? ` · ${deal.owner.name}` : ''}</p></div><strong className="text-sm text-lt-900">{money(deal.value, deal.currency)}</strong></article>)}
            {!contact.deals.length && <div className="grid justify-items-start gap-3"><Target size={22} className="text-brand"/><p className="m-0 text-sm leading-relaxed text-lt-600">Have a potential sale? Add its value and stage so you can track it in your pipeline.</p><Button size="xs" variant="secondary" onClick={() => setAction('deal')}>Create the first deal</Button></div>}
          </div>
        </WorkspaceSection></div>

        <div className="max-[900px]:order-3"><WorkspaceSection title="Conversation notes" description="What you learned, discussed, and agreed to.">
          <div className={`${cardClass} grid gap-4`}>
            {contact.notes.map((note) => <article key={note.id} className="border-b border-lt-100 pb-4 last:border-0 last:pb-0"><p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-lt-700">{note.body}</p><p className="mt-2 mb-0 text-xs text-lt-500">{note.author?.name || 'Former member'} · <LocalTime value={note.createdAt}/></p></article>)}
            {!contact.notes.length && <p className="m-0 text-sm text-lt-600">No notes yet. Capture the useful details from your first conversation.</p>}
          </div>
        </WorkspaceSection></div>

        <div className="max-[900px]:order-5"><WorkspaceSection title="Research history" description="Prepare for a conversation using this contact’s saved details.">
          <div className={`${cardClass} grid gap-3`}>{contact.researchRuns.map((run) => <Link key={run.id} className="flex items-center gap-3 rounded-xl border border-lt-200 p-4 hover:bg-lt-50" href={run.brief ? `/dashboard/briefs/${run.brief.id}` : `/dashboard/research/${run.id}`}><FileText size={18} className="shrink-0 text-brand"/><span className="min-w-0 flex-1"><strong className="block break-words text-sm text-brand">{run.brief?.title || `${label(run.goal)} research`}</strong><small className="mt-1 block text-lt-500">{label(run.status)} · <LocalTime value={run.requestedAt} dateOnly/></small></span><ArrowRight size={15} className="shrink-0 text-lt-500"/></Link>)}{!contact.researchRuns.length && <p className="m-0 text-sm leading-relaxed text-lt-600">No research yet. Choose Research contact to prepare a meeting brief or an outreach draft.</p>}</div>
        </WorkspaceSection></div>
      </div>

      <div className="grid min-w-0 gap-6 max-[900px]:contents">
        <div id="contact-follow-ups" className="scroll-mt-6 max-[900px]:order-1"><WorkspaceSection title="Follow-ups" description={`${openTasks.length} open · Check an action when it’s done.`}>
          <TaskList tasks={openTasks} emptyMessage="No open follow-ups. Set a next step using Add follow-up above."/>
          {completedTasks.length > 0 && <details className="rounded-xl border border-lt-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-lt-600">Completed · {completedTasks.length}</summary><div className="mt-3"><TaskList tasks={completedTasks}/></div></details>}
        </WorkspaceSection></div>
        <div className="max-[900px]:order-4"><WorkspaceSection title="Meetings" description="Optional · Schedule in your Google Calendar.">
          <div className={`${cardClass} grid gap-4`}><MeetingList meetings={contact.meetings} userId={userId}/>
            {!calendar.connected && <p className="m-0 border-t border-lt-100 pt-4 text-xs leading-relaxed text-lt-600">{calendar.configured ? <>Want to schedule here? <Link href="/dashboard/integrations" className="font-semibold text-brand">Connect your Calendar →</Link></> : 'Calendar is not enabled for this workspace yet. You can still track the next meeting as a follow-up.'}</p>}
          </div>
        </WorkspaceSection></div>
      </div>
    </div>

    <p className="m-0 text-xs text-lt-500">Showing the latest 50 research runs and up to 100 entries per history section.</p>
    <Modal open={action !== null} onClose={close} title={action ? titles[action] : ''} description={action === 'edit' ? undefined : `For ${contact.name}`}>
      {action === 'edit' && <ContactForm contact={contact} members={members} onSaved={close}/>}
      {action === 'deal' && <DealForm prospectId={contact.id} members={members} onSaved={close}/>}
      {action === 'note' && <NoteForm id={contact.id} onSaved={close}/>}
      {action === 'task' && <TaskForm id={contact.id} members={members} onSaved={close}/>}
      {action === 'meeting' && <MeetingForm prospectId={contact.id} hasEmail={Boolean(contact.email)} status={calendar} onSaved={close} onUseFollowUp={() => setAction('task')}/>}
    </Modal>
  </WorkspacePage>
}
