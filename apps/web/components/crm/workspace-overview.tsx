'use client'

import { ArrowRight, ListChecks, Search, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { dealTotals, type Deal, type Task } from '../../lib/crm'
import { ButtonLink } from '../ui/button'
import { MetricStrip } from './metrics'
import { TaskList } from './task-list'
import { taskTiming, useWorkspaceClock } from './use-workspace-clock'

const steps = [
  { icon: UsersRound, title: 'Add a contact', description: 'Save who you are talking to and where they work.' },
  { icon: Search, title: 'Prepare and track', description: 'Research the contact, then add a deal when there is an opportunity.' },
  { icon: ListChecks, title: 'Follow through', description: 'Capture a note and set a dated follow-up. Calendar is optional.' },
]

export function CrmOverview({ contacts, deals, tasks }: { contacts: number; deals: Deal[]; tasks: Task[] }) {
  const now = useWorkspaceClock()
  const openDeals = deals.filter((deal) => !['won', 'lost'].includes(deal.stage))
  const openTasks = tasks.filter((task) => !task.completedAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const overdue = openTasks.filter((task) => taskTiming(task.dueAt, now) === 'overdue')
  const isNew = contacts === 0 && deals.length === 0 && tasks.length === 0

  return <>
    <MetricStrip label="CRM overview" items={[
      { href: '/dashboard/contacts', value: contacts, label: 'Contacts', hint: 'People you are building relationships with' },
      { href: '/dashboard/pipeline', value: openDeals.length, label: 'Open deals', hint: dealTotals(openDeals).join(' + ') || 'Track your potential sales' },
      { href: '/dashboard/tasks', value: openTasks.length, label: 'Open follow-ups', tone: now && overdue.length ? 'danger' : 'default', hint: now && overdue.length ? `${overdue.length} overdue, start here` : 'Keep your next promises in sight' },
    ]}/>

    <section className={isNew ? 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,.8fr)] items-start gap-5 max-[760px]:grid-cols-1' : 'grid gap-5'} aria-label="Your CRM workflow">
      <div className="grid gap-4 rounded-2xl border border-lt-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="m-0 text-lg text-lt-900">Your next follow-ups</h2><p className="mt-1 mb-0 text-xs text-lt-600">Earliest due first, across your workspace.</p></div><Link href="/dashboard/tasks" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-lt-900">View all<ArrowRight size={14}/></Link></div><TaskList tasks={openTasks.slice(0, 3)} emptyMessage="No open follow-ups. Open a contact and add the next action you agreed on."/></div>
      {isNew && <div className="grid gap-5 rounded-2xl border border-lt-200 bg-lt-100/50 p-5"><div><h2 className="m-0 text-lg text-lt-900">Start with a person, leave with a next step</h2><p className="mt-1 mb-0 text-xs text-lt-600">A simple workflow for your first week.</p></div>
        <ul className="m-0 grid list-none gap-4 p-0">{steps.map(({ icon: Icon, title, description }) => <li key={title} className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-brand"><Icon size={16}/></span><div><strong className="text-sm text-lt-900">{title}</strong><p className="mt-0.5 mb-0 text-xs leading-relaxed text-lt-600">{description}</p></div></li>)}</ul>
        <ButtonLink href="/dashboard/contacts?add=1" size="xs" className="w-fit">Add your first contact<ArrowRight size={14}/></ButtonLink></div>}
    </section>
    {(deals.length === 500 || tasks.length === 500) && <p className="m-0 text-xs text-lt-500">Overview uses the latest 500 deals and up to 500 follow-ups.</p>}
  </>
}
