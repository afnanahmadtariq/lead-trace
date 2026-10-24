import { ArrowRight, Clock3, Search, Sparkles, UsersRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CrmOverview } from '../../components/crm/workspace-overview'
import { ButtonLink } from '../../components/ui/button'
import { EmptyState } from '../../components/ui/empty-state'
import { StatusBadge } from '../../components/ui/status-badge'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection } from '../../components/workspace/workspace-page'
import { ItemBody, ItemIcon, ItemMeta, WorkspaceList, WorkspaceListLink } from '../../components/workspace/workspace-list'
import { UrgencyBadge } from '../../components/urgency-badge'
import { briefCitations, briefUrgencyLabel } from '../../lib/brief'
import { formatDate } from '../../lib/format'
import type { ContactPage, Deal, Task } from '../../lib/crm'
import type { ResearchRunSummary } from '../../lib/research'
import { authenticatedFetch, requireWorkspace } from '../../lib/server-auth'

export default async function Page() {
  const [context, runs, contacts, deals, tasks] = await Promise.all([
    requireWorkspace(),
    authenticatedFetch<ResearchRunSummary[]>('/research-runs').then((value) => value ?? []),
    authenticatedFetch<ContactPage>('/crm/contacts'),
    authenticatedFetch<{ items: Deal[] }>('/crm/deals'),
    authenticatedFetch<Task[]>('/crm/tasks'),
  ])
  const readyRuns = runs.filter((run) => run.brief)
  const activeRuns = runs.filter((run) => run.status === 'queued' || run.status === 'running')
  const latestReady = readyRuns[0]

  return <WorkspacePage>
    <WorkspaceHeader eyebrow={`Welcome, ${context.user.name.split(' ')[0]}`} title="Make your next move." lead="Your contacts, opportunities, and follow-ups in one place. Start with the next conversation that needs your attention." action={<ButtonLink href="/dashboard/contacts?add=1"><UsersRound size={17}/>Add contact</ButtonLink>}/>

    <CrmOverview contacts={contacts?.total ?? 0} deals={deals?.items ?? []} tasks={tasks ?? []}/>

    <section className="grid grid-cols-[minmax(0,1.45fr)_minmax(240px,.55fr)] gap-3 max-[760px]:grid-cols-1" aria-label="Sales workspace summary">
      {latestReady ? <article className="relative overflow-hidden rounded-[20px] bg-lt-950 p-7 text-white shadow-panel max-[620px]:p-5">
        <span className="absolute -top-20 -right-16 size-64 rounded-full bg-sky/15 blur-2xl"/>
        <div className="relative z-1 flex h-full min-h-[220px] flex-col items-start">
          <p className="mt-0 mb-4 flex items-center gap-2 text-[.7rem] font-bold tracking-[.12em] text-sky uppercase"><Sparkles size={15}/>Ready to use</p>
          <h2 className="m-0 max-w-[650px] text-[clamp(1.75rem,3vw,2.55rem)] leading-[1.08] font-medium tracking-[-.045em]">{latestReady.prospect.name}{latestReady.prospect.companyName ? ` at ${latestReady.prospect.companyName}` : ''}</h2>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">{briefUrgencyLabel(latestReady.brief?.sections) && <UrgencyBadge label={briefUrgencyLabel(latestReady.brief?.sections)}/>}</div>
          <p className="mt-0 mb-6 max-w-[580px] text-sm leading-relaxed text-lt-300">{latestReady.goal === 'meeting' ? 'Meeting brief' : 'Outreach message'} built from {briefCitations(latestReady.brief?.sections).length} cited signal{briefCitations(latestReady.brief?.sections).length === 1 ? '' : 's'} and aligned to {latestReady.offer.name}.</p>
          <ButtonLink href={`/dashboard/briefs/${latestReady.brief!.id}`} variant="secondary" className="mt-auto">Open conversation brief<ArrowRight size={16}/></ButtonLink>
        </div>
      </article> : <article className="grid min-h-[220px] content-center justify-items-start rounded-[20px] border border-lt-200 bg-white p-7">
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-lt-100 text-brand"><Sparkles size={21}/></span>
        <h2 className="m-0 text-xl text-lt-900">Build your first conversation brief</h2>
        <p className="mt-2 mb-5 max-w-[520px] text-sm leading-relaxed text-lt-600">Add a prospect and your offer. Lead Trace will research the account and turn source-linked signals into a usable plan.</p>
        <ButtonLink href="/dashboard/research/new">Research a prospect<ArrowRight size={16}/></ButtonLink>
      </article>}

      <aside className="grid overflow-hidden rounded-[20px] border border-lt-200 bg-white" aria-label="Workspace pulse">
        <WorkspacePulse icon={<UsersRound size={17}/>} value={runs.length} label="Prospects researched"/>
        <WorkspacePulse icon={<Sparkles size={17}/>} value={readyRuns.length} label="Briefs ready"/>
        <WorkspacePulse icon={<Clock3 size={17}/>} value={activeRuns.length} label="In progress"/>
      </aside>
    </section>

    <WorkspaceSection title="Recent prospects" description="Open a ready brief directly, or check work still in progress." action={<Link href="/dashboard/research">View all</Link>}>
      {runs.length ? <WorkspaceList>{runs.slice(0, 4).map((run) => <WorkspaceListLink href={run.brief ? `/dashboard/briefs/${run.brief.id}` : `/dashboard/research/${run.id}`} key={run.id}>
        <ItemIcon>{run.brief ? <Sparkles size={18}/> : <Search size={18}/>}</ItemIcon><ItemBody title={<>{run.prospect.name}{run.prospect.companyName ? ` · ${run.prospect.companyName}` : ''}</>} description={<>{run.goal === 'meeting' ? 'Meeting brief' : 'Outreach message'} · {run.offer.name}</>}/><ItemMeta><div className="flex flex-col items-end gap-1.5"><StatusBadge status={run.brief ? 'ready' : run.status}/>{run.brief && <UrgencyBadge label={briefUrgencyLabel(run.brief.sections)}/>}</div><time>{formatDate(run.requestedAt, { year: undefined })}</time></ItemMeta>
      </WorkspaceListLink>)}</WorkspaceList> : <EmptyState icon={<Search size={20}/>} title="Your first signal starts here" body="Add a prospect and your offer context. Lead Trace will preserve the inputs and prepare a source-first research run." action={<Link href="/dashboard/research/new">Create a research run</Link>}/>}
    </WorkspaceSection>
  </WorkspacePage>
}

function WorkspacePulse({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return <div className="flex items-center gap-3 border-b border-lt-100 px-5 py-4 last:border-0"><span className="grid size-9 place-items-center rounded-[11px] bg-lt-100 text-brand">{icon}</span><strong className="text-xl tracking-[-.03em] text-lt-900">{value}</strong><span className="text-xs text-lt-500">{label}</span></div>
}
