'use client'

import { CheckCheck, Clock3, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { type Person, type Task } from '../../lib/crm'
import { WorkspaceHeader, WorkspacePage } from '../workspace/workspace-page'
import { CreateRecordButton } from './create-record'
import { TaskList } from './task-list'
import { taskTiming, useWorkspaceClock } from './use-workspace-clock'

const filters = [ ['all', 'All open'], ['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming'] ] as const
type Filter = typeof filters[number][0]

export function FollowUpWorkspace({ tasks, members }: { tasks: Task[]; members: Person[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const now = useWorkspaceClock()
  const open = tasks.filter((task) => !task.completedAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
  const completed = tasks.filter((task) => task.completedAt)
  const visible = filter === 'all' ? open : open.filter((task) => taskTiming(task.dueAt, now) === filter)
  const count = (value: Filter) => value === 'all' ? open.length : open.filter((task) => taskTiming(task.dueAt, now) === value).length

  return <WorkspacePage>
    <WorkspaceHeader eyebrow="Follow-ups" title="Know what needs your attention." lead="Start with what’s overdue, then work through today’s conversations. Every action stays linked to a contact." action={<CreateRecordButton kind="task" members={members}/>}/>
    <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-1" aria-label="Follow-up summary">{[
      { label: 'Overdue', value: now ? count('overdue') : '—', icon: Clock3, color: 'text-danger' },
      { label: 'Due today', value: now ? count('today') : '—', icon: ListChecks, color: 'text-brand' },
      { label: 'Completed', value: completed.length, icon: CheckCheck, color: 'text-success' },
    ].map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-lt-200 bg-white p-5"><Icon size={22} className={color}/><div><strong className={`block text-2xl ${color}`}>{value}</strong><span className="text-xs text-lt-600">{label}</span></div></div>)}</div>
    <section className="grid gap-4" aria-label="Open follow-ups">
      <div className="flex flex-wrap gap-2" aria-label="Filter follow-ups">{filters.map(([value, title]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filter === value ? 'border-brand bg-brand text-white' : 'border-lt-200 bg-white text-lt-600 hover:border-brand/40'}`}>{title}<span className="ml-2 opacity-75">{value !== 'all' && !now ? '—' : count(value)}</span></button>)}</div>
      <TaskList tasks={visible} emptyMessage={filter === 'all' ? 'You’re all caught up. Add a follow-up when a contact has a next step.' : `No ${filter === 'today' ? 'remaining follow-ups due today' : `${filter} follow-ups`}. Choose another view or add a next action.`}/>
    </section>
    <details className="rounded-2xl border border-lt-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-lt-600">Completed · {completed.length}</summary><p className="mb-4 text-xs text-lt-500">Uncheck an action to reopen it.</p><TaskList tasks={completed} emptyMessage="Completed actions will appear here."/></details>
    <p className="m-0 text-xs text-lt-500">Showing up to 500 follow-ups across your workspace, with open actions first. Dates use your local time.</p>
  </WorkspacePage>
}
