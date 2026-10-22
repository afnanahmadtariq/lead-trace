import type { Contact } from '../../../../lib/crm'
import { ResearchRunForm } from '../../../../components/research-run-form'
import { WorkspaceHeader, WorkspacePage } from '../../../../components/workspace/workspace-page'
import type { ResearchRunSummary } from '../../../../lib/research'
import { authenticatedFetch } from '../../../../lib/server-auth'

export default async function Page({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const contactId = (await searchParams).contact
  const contact = typeof contactId === 'string' ? await authenticatedFetch<Contact>(`/crm/contacts/${encodeURIComponent(contactId)}`) : undefined
  const recentRuns = await authenticatedFetch<ResearchRunSummary[]>('/research-runs').catch(() => []) ?? []
  const latestOffer = recentRuns[0]?.offer

  return <WorkspacePage>
    <WorkspaceHeader eyebrow="New conversation brief" title="Research once. Walk in prepared." lead="Tell us who you are meeting or contacting. We will find the strongest public signals and turn them into a usable plan."/>
    <ResearchRunForm initialOffer={latestOffer} contact={contact ?? undefined}/>
  </WorkspacePage>
}
