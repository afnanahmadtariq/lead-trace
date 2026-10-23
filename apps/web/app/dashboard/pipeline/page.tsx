import { Pipeline } from '../../../components/crm/pipeline'
import { CreateRecordButton } from '../../../components/crm/create-record'
import { WorkspaceHeader, WorkspacePage } from '../../../components/workspace/workspace-page'
import type { Deal, Person } from '../../../lib/crm'
import { requireFetch } from '../../../lib/server-auth'

export default async function Page() {
  const [deals, members] = await Promise.all([requireFetch<{ items: Deal[] }>('/crm/deals'), requireFetch<Person[]>('/crm/members')])
  return <WorkspacePage><WorkspaceHeader eyebrow="Pipeline" title="See where every opportunity stands." lead="A deal is a potential sale linked to a contact. Update its stage as the conversation moves toward a decision." action={<CreateRecordButton kind="deal" members={members}/>}/><Pipeline deals={deals.items} members={members}/></WorkspacePage>
}
