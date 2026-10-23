'use client'
import { LocalTime } from './local-time'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import { apiRequest } from '../../lib/api-client'
import { type Task } from '../../lib/crm'
import { useWorkspaceClock } from './use-workspace-clock'

export function TaskList({ tasks, emptyMessage = 'No follow-ups yet. Add the next action from a contact.' }: { tasks: Task[]; emptyMessage?: string }) {
  const now = useWorkspaceClock()
  const router = useRouter(), [pending, startTransition] = useTransition(), [error, setError] = useState('')
  const [visibleTasks, toggle] = useOptimistic(tasks, (current, change: { id: string; completed: boolean }) => current.map((task) => task.id === change.id ? { ...task, completedAt: change.completed ? 'completed' : null } : task))
  return <div className="grid gap-2">{error && <p role="alert" className="text-sm text-danger">{error}</p>}{visibleTasks.map((task) => <article className="flex items-start gap-3 rounded-xl border border-lt-200 bg-white p-4" key={task.id}>
    <input className="mt-1 size-4 accent-brand" type="checkbox" aria-label={`Complete ${task.title}`} checked={Boolean(task.completedAt)} disabled={pending} onChange={(event) => {
      const completed = event.target.checked
      startTransition(async () => {
        toggle({ id: task.id, completed }); setError('')
        try { await apiRequest(`/crm/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed }) }); router.refresh() }
        catch (error) { setError(error instanceof Error ? error.message : 'Could not update follow-up') }
      })
    }}/><div className="min-w-0"><h3 className={`m-0 text-sm text-lt-900 ${task.completedAt ? 'line-through opacity-60' : ''}`}>{task.title}</h3><p className={`mt-1 mb-0 text-xs ${!task.completedAt && Date.parse(task.dueAt) < now ? 'text-danger' : 'text-lt-500'}`}><LocalTime value={task.dueAt}/> · {task.owner?.name || 'Unassigned'}</p>{task.prospect && <Link className="mt-2 block text-xs text-brand" href={`/dashboard/contacts/${task.prospectId}`}>{task.prospect.name}</Link>}</div>
  </article>)}{!tasks.length && <p className="rounded-xl border border-dashed border-lt-300 bg-white p-5 text-sm leading-relaxed text-lt-600">{emptyMessage}</p>}</div>
}
