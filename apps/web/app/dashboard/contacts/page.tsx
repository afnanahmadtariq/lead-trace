import { ContactDirectory } from '../../../components/crm/contact-directory'
import { WorkspaceHeader, WorkspacePage } from '../../../components/workspace/workspace-page'
import type { ContactPage, Person } from '../../../lib/crm'
import { requireFetch } from '../../../lib/server-auth'

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; add?: string }> }) {
  const query = await searchParams
  const q = typeof query.q === 'string' ? query.q : ''
  const page = Math.min(200000, Math.max(1, Math.floor(Number(query.page) || 1)))
  const [data, members] = await Promise.all([requireFetch<ContactPage>(`/crm/contacts?q=${encodeURIComponent(q)}&page=${page}`), requireFetch<Person[]>('/crm/members')])
  return <WorkspacePage><WorkspaceHeader eyebrow="Contacts" title="Your relationships, in one place." lead="Add a person, prepare for the conversation, and keep their deals and next steps together."/><ContactDirectory key={`${q}:${page}:${query.add}`} data={data} members={members} search={q} initialCreate={query.add === '1'}/></WorkspacePage>
}
