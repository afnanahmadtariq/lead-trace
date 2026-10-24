'use client'
import { Check } from 'lucide-react'
import { DeleteButton } from './delete-button'
import { LocalTime } from './local-time'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import { apiRequest } from '../../lib/api-client'
import { emptyClass, type Task } from '../../lib/crm'
import { FormMessage } from '../ui/form-message'
import { Badge } from './badges'
import { taskTiming, useWorkspaceClock } from './use-workspace-clock'

export function TaskList({ tasks, emptyMessage = 'No follow-ups yet. Add the next action from a contact.' }: { tasks: Task[]; emptyMessage?: string }) {
  const now = useWorkspaceClock()
  const router = useRouter(), [pending, startTransition] = useTransition(), [error, setError] = useState('')
  const [visibleTasks, toggle] = useOptimistic(tasks, (current, change: { id: string; completed: boolean }) => current.map((task) => task.id === change.id ? { ...task, completedAt: change.completed ? 'completed' : null } : task))
  return <div className="grid gap-2">{error && <FormMessage tone="error" role="alert">{error}</FormMessage>}{visibleTasks.map((task) => {
    const timing = !task.completedAt && now ? taskTiming(task.dueAt, now) : null
    return <article className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors motion-reduce:transition-none ${timing === 'overdue' ? 'border-danger/25 bg-[#fffafb]' : timing === 'today' ? 'border-brand/25 bg-lt-50' : 'border-lt-200 bg-white hover:border-lt-300'}`} key={task.id}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center"><input className="peer size-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-lt-300 bg-white transition-colors checked:border-brand checked:bg-brand hover:border-brand disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none" type="checkbox" aria-label={`Complete ${task.title}`} checked={Boolean(task.completedAt)} disabled={pending} onChange={(event) => {
        const completed = event.target.checked
        startTransition(async () => {
          toggle({ id: task.id, completed }); setError('')
          try { await apiRequest(`/crm/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed }) }); router.refresh() }
          catch (error) { setError(error instanceof Error ? error.message : 'Could not update follow-up') }
        })
      }}/><Check size={13} strokeWidth={3} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" aria-hidden="true"/></span>
      <div className="min-w-0 flex-1"><h3 className={`m-0 text-sm leading-snug font-semibold break-words ${task.completedAt ? 'text-lt-500 line-through' : 'text-lt-900'}`}>{task.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-lt-500">
          {timing === 'overdue' && <Badge tone="danger">Overdue</Badge>}{timing === 'today' && <Badge tone="brand">Due today</Badge>}
          <span className={timing === 'overdue' ? 'font-medium text-danger' : timing === 'today' ? 'font-medium text-brand' : ''}><LocalTime value={task.dueAt}/></span>
          <span>{task.owner?.name || 'Unassigned'}</span>
          {task.prospect && <Link className="font-medium text-lt-700 hover:text-brand" href={`/dashboard/contacts/${task.prospectId}`}>{task.prospect.name}</Link>}
        </div></div>
      <div className="shrink-0"><DeleteButton quiet noun="follow-up" name={`Delete follow-up: ${task.title}`} path={`/crm/tasks/${task.id}`} description={`“${task.title}” will be removed from this contact’s follow-ups.`}/></div>
    </article>
  })}{!tasks.length && <p className={`m-0 ${emptyClass}`}>{emptyMessage}</p>}</div>
}
