import Link from 'next/link'
import { LeadSearchResults } from '../../../../components/leads/search-results'
import { WorkspaceHeader, WorkspacePage } from '../../../../components/workspace/workspace-page'
import type { Person } from '../../../../lib/crm'
import type { LeadCapabilities, LeadSearchDetail } from '../../../../lib/leads'
import { authenticatedFetch, requireFetch } from '../../../../lib/server-auth'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const search = await requireFetch<LeadSearchDetail>(`/leads/searches/${encodeURIComponent(id)}`)
  const [members, capabilities] = await Promise.all([authenticatedFetch<Person[]>('/crm/members'), authenticatedFetch<LeadCapabilities>('/leads/capabilities')])
  if (!capabilities) return null
  return <WorkspacePage><Link className="text-sm text-brand" href="/dashboard/leads">← All lead searches</Link><WorkspaceHeader eyebrow="Lead discovery" title={search.title} lead={[search.role, search.industry, search.location, search.keywords].filter(Boolean).join(' · ')}/><LeadSearchResults search={search} members={members ?? []} capabilities={capabilities}/></WorkspacePage>
}
