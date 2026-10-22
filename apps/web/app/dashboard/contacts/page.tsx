import { ContactDirectory } from '../../../components/crm/contact-directory'
import { WorkspaceHeader, WorkspacePage } from '../../../components/workspace/workspace-page'
import type { ContactPage, Person } from '../../../lib/crm'
import { authenticatedFetch } from '../../../lib/server-auth'

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const query = await searchParams
  const q = typeof query.q === 'string' ? query.q : ''
  const page = Math.min(200000, Math.max(1, Math.floor(Number(query.page) || 1)))
  const [data, members] = await Promise.all([authenticatedFetch<ContactPage>(`/crm/contacts?q=${encodeURIComponent(q)}&page=${page}`), authenticatedFetch<Person[]>('/crm/members')])
  if (!data) return null
  return <WorkspacePage><WorkspaceHeader eyebrow="Contacts" title="Relationships with a next step." lead="One contact record for research, deals, conversations, and follow-ups."/><ContactDirectory data={data} members={members ?? []} search={q}/></WorkspacePage>
}
