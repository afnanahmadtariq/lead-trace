'use client'

import { useState } from 'react'
import { type Person, type Task } from '../../lib/crm'
import { WorkspaceHeader, WorkspacePage } from '../workspace/workspace-page'
import { CreateRecordButton } from './create-record'
import { MetricStrip } from './metrics'
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
    <MetricStrip label="Follow-up summary" items={[
      { label: 'Overdue', value: now ? count('overdue') : '…', tone: now && count('overdue') ? 'danger' : 'default', hint: 'Past their due time' },
      { label: 'Due today', value: now ? count('today') : '…', tone: 'brand', hint: 'Still to do today' },
      { label: 'Completed', value: completed.length, tone: 'success', hint: 'Done and checked off' },
    ]}/>
    <section className="grid gap-3" aria-label="Open follow-ups">
      <div className="flex flex-wrap gap-2" aria-label="Filter follow-ups">{filters.map(([value, title]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${filter === value ? 'border-brand bg-brand text-white' : 'border-lt-200 bg-white text-lt-600 hover:border-lt-300 hover:text-lt-900'}`}>{title}<span className={`tabular-nums ${filter === value ? 'text-white/80' : 'text-lt-500'}`}>{value !== 'all' && !now ? '…' : count(value)}</span></button>)}</div>
      <TaskList tasks={visible} emptyMessage={filter === 'all' ? 'You’re all caught up. Add a follow-up when a contact has a next step.' : `No ${filter === 'today' ? 'remaining follow-ups due today' : `${filter} follow-ups`}. Choose another view or add a next action.`}/>
    </section>
    <details className="rounded-2xl border border-lt-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-lt-700">Completed · {completed.length}</summary><p className="mt-3 mb-4 text-xs text-lt-500">Uncheck an action to reopen it.</p><TaskList tasks={completed} emptyMessage="Completed actions will appear here."/></details>
    <p className="m-0 text-xs text-lt-500">Showing up to 500 follow-ups across your workspace, with open actions first. Dates use your local time.</p>
  </WorkspacePage>
}
