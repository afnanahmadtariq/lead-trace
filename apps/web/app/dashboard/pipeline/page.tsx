import { Pipeline } from '../../../components/crm/pipeline'
import { ButtonLink } from '../../../components/ui/button'
import { WorkspaceHeader, WorkspacePage } from '../../../components/workspace/workspace-page'
import type { Deal, Person } from '../../../lib/crm'
import { authenticatedFetch } from '../../../lib/server-auth'

export default async function Page() {
  const [deals, members] = await Promise.all([authenticatedFetch<{ items: Deal[] }>('/crm/deals'), authenticatedFetch<Person[]>('/crm/members')])
  return <WorkspacePage><WorkspaceHeader eyebrow="Pipeline" title="Move the right deals forward." lead="Track value, ownership, expected close dates, and progress from first contact to a decision." action={<ButtonLink href="/dashboard/contacts">Add a deal from a contact</ButtonLink>}/><Pipeline deals={deals?.items ?? []} members={members ?? []}/></WorkspacePage>
}
