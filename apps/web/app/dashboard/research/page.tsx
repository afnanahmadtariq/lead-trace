import { Plus } from 'lucide-react'
import { ProspectDirectory } from '../../../components/prospect-directory'
import { ButtonLink } from '../../../components/ui/button'
import { WorkspaceHeader, WorkspacePage } from '../../../components/workspace/workspace-page'
import type { ResearchRunSummary } from '../../../lib/research'
import { requireFetch } from '../../../lib/server-auth'

export default async function Page() {
  const runs = await requireFetch<ResearchRunSummary[]>('/research-runs')
  return <WorkspacePage>
    <WorkspaceHeader eyebrow="Prospects" title="Every conversation, prepared." lead="Ready briefs open in one click. Active prospects show progress until their signals and recommendations are ready." action={<ButtonLink href="/dashboard/research/new"><Plus size={17}/>Research a prospect</ButtonLink>}/>
    <ProspectDirectory runs={runs}/>
  </WorkspacePage>
}
