import { TaskList } from '../../../components/crm/task-list'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection } from '../../../components/workspace/workspace-page'
import type { Task } from '../../../lib/crm'
import { authenticatedFetch } from '../../../lib/server-auth'

export default async function Page() {
  const tasks = await authenticatedFetch<Task[]>('/crm/tasks') ?? []
  const open = tasks.filter((task) => !task.completedAt), completed = tasks.filter((task) => task.completedAt)
  return <WorkspacePage><WorkspaceHeader eyebrow="Follow-ups" title="Keep the next step in sight." lead="Workspace follow-ups ordered by due date. Add actions and assign an owner from each contact."/><WorkspaceSection title={`Open actions · ${open.length}`} description="Check an action when it is complete."><TaskList tasks={open}/></WorkspaceSection><details><summary className="cursor-pointer text-sm font-semibold text-lt-600">Completed · {completed.length}</summary><div className="mt-4"><TaskList tasks={completed}/></div></details><p className="text-xs text-lt-500">Showing up to 500 follow-ups, with open actions first.</p></WorkspacePage>
}
