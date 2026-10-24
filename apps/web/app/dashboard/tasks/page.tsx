import { FollowUpWorkspace } from '../../../components/crm/follow-up-workspace'
import type { Person, Task } from '../../../lib/crm'
import { requireFetch } from '../../../lib/server-auth'

export default async function Page() {
  const [tasks, members] = await Promise.all([requireFetch<Task[]>('/crm/tasks'), requireFetch<Person[]>('/crm/members')])
  return <FollowUpWorkspace tasks={tasks} members={members}/>
}
