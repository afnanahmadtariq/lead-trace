import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LeadSearchResults } from '../../../../components/leads/search-results'
import { WorkspaceHeader, WorkspacePage } from '../../../../components/workspace/workspace-page'
import { API_URL } from '../../../../lib/api-client'
import type { Person } from '../../../../lib/crm'
import type { LeadCapabilities, LeadSearchDetail } from '../../../../lib/leads'
import { authenticatedFetch } from '../../../../lib/server-auth'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const response = await fetch(`${API_URL}/leads/searches/${encodeURIComponent(id)}`, { cache: 'no-store', headers: { cookie: (await headers()).get('cookie') || '' } })
  if (response.status === 404) notFound()
  if (!response.ok) throw new Error('Could not load lead search')
  const search = await response.json() as LeadSearchDetail
  const [members, capabilities] = await Promise.all([authenticatedFetch<Person[]>('/crm/members'), authenticatedFetch<LeadCapabilities>('/leads/capabilities')])
  if (!capabilities) return null
  return <WorkspacePage><Link className="text-sm text-brand" href="/dashboard/leads">← All lead searches</Link><WorkspaceHeader eyebrow="Lead discovery" title={search.title} lead={[search.role, search.industry, search.location, search.keywords].filter(Boolean).join(' · ')}/><LeadSearchResults search={search} members={members ?? []} capabilities={capabilities}/></WorkspacePage>
}
