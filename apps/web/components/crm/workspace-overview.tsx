'use client'

import { ArrowRight, ListChecks, Target, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { money, type Deal, type Task } from '../../lib/crm'
import { ButtonLink } from '../ui/button'
import { TaskList } from './task-list'
import { taskTiming, useWorkspaceClock } from './use-workspace-clock'

export function CrmOverview({ contacts, deals, tasks }: { contacts: number; deals: Deal[]; tasks: Task[] }) {
  const now = useWorkspaceClock()
  const openDeals = deals.filter((deal) => !['won', 'lost'].includes(deal.stage))
  const openTasks = tasks.filter((task) => !task.completedAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const overdue = openTasks.filter((task) => taskTiming(task.dueAt, now) === 'overdue')
  const currencies = [...new Set(openDeals.map((deal) => deal.currency))]

  return <>
    <div className="grid grid-cols-3 gap-3 max-[620px]:grid-cols-1" aria-label="CRM overview">{[
      { href: '/dashboard/contacts', icon: UsersRound, value: contacts, title: 'Contacts', description: 'People you’re building relationships with' },
      { href: '/dashboard/pipeline', icon: Target, value: openDeals.length, title: 'Open deals', description: currencies.map((currency) => money(openDeals.filter((deal) => deal.currency === currency).reduce((sum, deal) => sum + Number(deal.value), 0), currency)).join(' + ') || 'Track your potential sales' },
      { href: '/dashboard/tasks', icon: ListChecks, value: openTasks.length, title: 'Open follow-ups', description: now && overdue.length ? `${overdue.length} overdue · Start here` : 'Keep your next promises in sight' },
    ].map(({ href, icon: Icon, value, title, description }) => <Link key={href} href={href} className="group grid gap-3 rounded-2xl border border-lt-200 bg-white p-5 transition-colors hover:border-brand/40"><div className="flex items-center justify-between"><Icon size={19} className="text-brand"/><ArrowRight size={16} className="text-lt-500 group-hover:text-brand"/></div><div><strong className="text-3xl tracking-tight text-lt-900">{value}</strong><span className="ml-2 text-sm font-semibold text-lt-700">{title}</span><p className="mt-2 mb-0 text-xs leading-relaxed text-lt-600">{description}</p></div></Link>)}</div>

    <section className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,.8fr)] items-start gap-5 max-[760px]:grid-cols-1" aria-label="Your CRM workflow">
      <div className="grid gap-4 rounded-2xl border border-lt-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="m-0 text-lg text-lt-900">Your next follow-ups</h2><p className="mt-1 mb-0 text-xs text-lt-600">Earliest due first, across your workspace.</p></div><Link href="/dashboard/tasks" className="text-sm font-semibold text-brand">View all →</Link></div><TaskList tasks={openTasks.slice(0, 3)} emptyMessage="No open follow-ups. Open a contact and add the next action you agreed on."/></div>
      <div className="rounded-2xl border border-brand/20 bg-lt-100/60 p-5"><p className="mt-0 mb-2 text-xs font-semibold text-brand">A SIMPLE SALES WORKFLOW</p><h2 className="m-0 text-xl tracking-tight text-lt-900">Start with a person. Leave with a next step.</h2><ol className="my-5 grid list-none gap-4 p-0">{[['1', 'Add a contact', 'Save who you’re talking to and where they work.'], ['2', 'Prepare and track', 'Research the contact, then add a deal when there’s an opportunity.'], ['3', 'Follow through', 'Capture a note and set a dated follow-up. Calendar is optional.']].map(([step, title, description]) => <li key={step} className="flex items-start gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand">{step}</span><div><strong className="text-sm text-lt-900">{title}</strong><p className="mt-1 mb-0 text-xs leading-relaxed text-lt-600">{description}</p></div></li>)}</ol><ButtonLink href="/dashboard/contacts?add=1" size="xs">{contacts ? 'Add another contact' : 'Add your first contact'}<ArrowRight size={14}/></ButtonLink></div>
    </section>
    {(deals.length === 500 || tasks.length === 500) && <p className="m-0 text-xs text-lt-500">Overview uses the latest 500 deals and up to 500 follow-ups.</p>}
  </>
}
