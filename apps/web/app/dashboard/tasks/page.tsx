import { FollowUpWorkspace } from '../../../components/crm/follow-up-workspace'
import type { Person, Task } from '../../../lib/crm'
import { authenticatedFetch } from '../../../lib/server-auth'

export default async function Page() {
  const [tasks, members] = await Promise.all([authenticatedFetch<Task[]>('/crm/tasks'), authenticatedFetch<Person[]>('/crm/members')])
  return <FollowUpWorkspace tasks={tasks ?? []} members={members ?? []}/>
}
