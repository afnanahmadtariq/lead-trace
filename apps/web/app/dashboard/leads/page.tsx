import Link from 'next/link'
import { LeadSearchForm } from '../../../components/leads/search-form'
import { LocalTime } from '../../../components/crm/local-time'
import { ButtonLink } from '../../../components/ui/button'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection } from '../../../components/workspace/workspace-page'
import { cardClass, label } from '../../../lib/crm'
import type { LeadCapabilities, LeadSearchPage } from '../../../lib/leads'
import { authenticatedFetch } from '../../../lib/server-auth'

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.min(200000, Math.max(1, Math.floor(Number((await searchParams).page) || 1)))
  const [capabilities, searches] = await Promise.all([authenticatedFetch<LeadCapabilities>('/leads/capabilities'), authenticatedFetch<LeadSearchPage>(`/leads/searches?page=${page}`)])
  if (!capabilities || !searches) return null
  return <WorkspacePage><WorkspaceHeader eyebrow="Lead generation" title="Find your next sales conversation." lead="Describe your ideal buyer. Review public source evidence, qualify the fit, and save the right people into CRM."/>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start gap-6 max-[1000px]:grid-cols-1">
      <WorkspaceSection title="Start a lead search" description="Begin with a specific role and market."><div className={cardClass}><LeadSearchForm capabilities={capabilities}/></div></WorkspaceSection>
      <WorkspaceSection title="Saved searches" description={`${searches.total} searches in this workspace. Criteria and source snapshots stay with each search.`}>
        <div className="grid gap-3">{searches.items.map((search) => <Link key={search.id} href={`/dashboard/leads/${search.id}`} className={`${cardClass} block transition hover:border-brand/40`}><div className="flex items-start justify-between gap-3"><h2 className="m-0 text-base text-lt-900">{search.title}</h2><span className="rounded-full bg-lt-100 px-3 py-1 text-xs text-brand">{label(search.status)}</span></div><p className="mt-2 mb-0 text-sm text-lt-600">{search.role} · {search.industry}{search.location ? ` · ${search.location}` : ''}</p><p className="mt-3 mb-0 text-xs text-lt-500">{search._count?.candidates ?? 0} leads · {search._count?.sources ?? 0} sources · <LocalTime value={search.createdAt} dateOnly/></p></Link>)}{!searches.items.length && <div className={`${cardClass} py-12 text-center text-sm text-lt-500`}>Your lead searches will appear here.</div>}</div>
        <div className="flex justify-between gap-2">{page > 1 && <ButtonLink variant="secondary" href={`/dashboard/leads?page=${page - 1}`}>Previous</ButtonLink>}{page * searches.pageSize < searches.total && <ButtonLink variant="secondary" href={`/dashboard/leads?page=${page + 1}`}>Next</ButtonLink>}</div>
      </WorkspaceSection>
    </div>
  </WorkspacePage>
}
