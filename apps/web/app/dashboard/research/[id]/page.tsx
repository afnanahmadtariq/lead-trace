import { ArrowLeft, ArrowUpRight, Check, CircleDashed, FileCheck2, Search } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { ResearchRunActions } from '../../../../components/research-run-actions'
import { ResearchRunLive } from '../../../../components/research-run-live'
import { ResearchRunPoller } from '../../../../components/research-run-poller'
import { SignalTimeline } from '../../../../components/signal-timeline'
import { ButtonLink } from '../../../../components/ui/button'
import { EmptyState } from '../../../../components/ui/empty-state'
import { StatusBadge } from '../../../../components/ui/status-badge'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection, WorkspaceSplit } from '../../../../components/workspace/workspace-page'
import { briefCitations } from '../../../../lib/brief'
import { formatConfidence, formatDate } from '../../../../lib/format'
import type { ResearchRunDetail } from '../../../../lib/research'
import { authenticatedFetch } from '../../../../lib/server-auth'

function ResearchCallout({ tone, icon, title, body, children }: { tone?: 'success' | 'error'; icon: ReactNode; title: string; body: ReactNode; children?: ReactNode }) {
  return <section className="flex items-center justify-between gap-6 rounded-2xl border border-lt-200 bg-white p-5 max-[700px]:flex-col max-[700px]:items-start data-[tone=success]:border-[#ccebdc] data-[tone=success]:bg-[#f7fcf9] data-[tone=error]:border-[#f0cbd1] data-[tone=error]:bg-[#fffafb]" data-tone={tone}>
    <div className="flex items-start gap-[13px]"><span className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${tone === 'success' ? 'bg-[#e2f6ec] text-success' : tone === 'error' ? 'bg-[#fff0f2] text-danger' : 'bg-lt-100 text-brand'}`}>{icon}</span><div><h2 className="mt-0 mb-[5px] text-[.98rem] text-lt-900">{title}</h2><p className="m-0 max-w-[680px] text-[.82rem] leading-[1.55] text-lt-600">{body}</p></div></div>
    {children}
  </section>
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = await authenticatedFetch<ResearchRunDetail>(`/research-runs/${id}`).catch(() => null)
  if (!run) notFound()
  const citations = briefCitations(run.brief?.sections, run.evidence)
  const citedIds = new Set(citations.map((item) => item.evidence_id))
  const discoveryComplete = run.sources.length > 0
  const evidenceComplete = run.evidence.length > 0
  const briefStatus = run.brief?.status ?? null
  const briefReady = briefStatus === 'ready'
  const briefRefreshing = briefStatus === 'refreshing'
  const showProgress = run.status !== 'completed' || !briefReady

  return <WorkspacePage>
    <ResearchRunPoller status={run.status}/>
    <Link className="inline-flex w-fit items-center gap-[7px] text-[.81rem] font-semibold text-lt-600 transition-colors duration-300 ease-fluid hover:text-brand motion-reduce:transition-none" href="/dashboard/research"><ArrowLeft size={15}/>Prospects</Link>
    <WorkspaceHeader eyebrow={run.goal === 'meeting' ? 'Meeting brief' : 'Outreach brief'} title={run.prospect.name} lead={<>{run.prospect.companyName || run.prospect.email || 'Prospect research'} · Positioning <strong>{run.offer.name}</strong>.</>} action={<StatusBadge status={run.status}/>}/>

    {showProgress && <ResearchRunLive status={run.status} discoveryComplete={discoveryComplete} evidenceComplete={evidenceComplete} briefStatus={briefStatus} sourceCount={run.sources.length} evidenceCount={run.evidence.length} evidence={run.evidence}/>}

    {run.status === 'queued' && <ResearchCallout icon={<Search size={19}/>} title="Ready for public-source discovery" body="Launch the current Tavily discovery stage. It searches profile, company, and recent-signal queries in parallel while keeping every returned URL traceable."><ResearchRunActions run={run}/></ResearchCallout>}
    {run.status === 'running' && briefRefreshing && run.brief && <ResearchCallout icon={<CircleDashed size={19}/>} title="Refreshing your conversation brief" body="The worker is updating recommendations from the latest stored evidence. This page refreshes automatically."><ButtonLink href={`/dashboard/briefs/${run.brief.id}`}>View current brief<ArrowUpRight size={16}/></ButtonLink></ResearchCallout>}
    {run.status === 'running' && !briefRefreshing && !discoveryComplete && <ResearchCallout icon={<CircleDashed size={19}/>} title="Discovery is in progress" body="The request has been claimed. Refresh to inspect sources as soon as collection finishes."><ResearchRunActions run={run}/></ResearchCallout>}
    {run.status === 'running' && !briefRefreshing && discoveryComplete && !briefReady && <ResearchCallout icon={<CircleDashed size={19}/>} title="Building your conversation brief" body="Your sources are collected. Lead Trace is selecting relevant claims and writing your brief. You can leave this page and return from Prospects when it is ready."><ResearchRunActions run={run}/></ResearchCallout>}
    {run.status === 'completed' && briefReady && run.brief && <ResearchCallout tone="success" icon={<Check size={19}/>} title="Your conversation brief is ready" body={`${citations.length} cited signal${citations.length === 1 ? '' : 's'} shaped the recommended opener, questions, and next step.`}><ButtonLink href={`/dashboard/briefs/${run.brief.id}`}>Use this brief<ArrowUpRight size={16}/></ButtonLink></ResearchCallout>}
    {run.status === 'failed' && <ResearchCallout tone="error" icon={<CircleDashed size={19}/>} title="Research needs attention" body={run.errorMessage || 'The provider could not complete this run. Retry after checking the project integration.'}><ResearchRunActions run={run}/></ResearchCallout>}

    {run.evidence.length > 0 && run.status === 'completed' && <SignalTimeline evidence={run.evidence.filter((item) => citedIds.has(item.id))} title="Signals selected for your brief"/>}

    <WorkspaceSplit>
      <div className="grid gap-7">
        <WorkspaceSection title="Collected sources" description="Raw public material—useful context, not verified claims yet." action={<Link href="/dashboard/evidence">Evidence library</Link>}>
          {run.sources.length ? <div className="grid grid-cols-2 gap-2.5 max-[700px]:grid-cols-1">{run.sources.map((source) => <article className="flex min-w-0 flex-col rounded-[15px] border border-lt-200 bg-white p-[18px]" key={source.id}>
            <div className="flex items-center justify-between gap-3 text-[.68rem] font-[650] tracking-[.06em] text-brand uppercase"><span className="truncate">{source.publisher || 'Public web'}</span><a className="grid size-[29px] shrink-0 place-items-center rounded-lg bg-lt-100" href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`}><ArrowUpRight size={16}/></a></div>
            <h3 className="mt-[15px] mb-2 text-[.92rem] leading-[1.35] text-lt-900">{source.title}</h3>{source.excerpt && <p className="mb-[18px] line-clamp-4 text-[.78rem] leading-[1.55] text-lt-600">{source.excerpt}</p>}<footer className="mt-auto flex items-center justify-between gap-2.5 border-t border-lt-100 pt-[13px] text-[.66rem] text-lt-500 capitalize"><span>{source.sourceType.replace(/-/g, ' ')}</span><time>{source.publishedAt ? 'Published ' : 'Retrieved '}{formatDate(source.publishedAt || source.retrievedAt)}</time></footer>
          </article>)}</div> : <EmptyState icon={<Search size={20}/>} title="No public sources yet" body="Start discovery above. Sources appear here before any AI-generated claim is allowed into the evidence layer."/>}
        </WorkspaceSection>

        <WorkspaceSection title="Collected evidence" description="Normalized claims that retain a direct source citation.">
          {run.evidence.length ? <div className="grid gap-[9px]">{run.evidence.map((item) => <article className="rounded-[14px] border border-lt-200 bg-white p-[18px]" id={`evidence-${item.id}`} key={item.id}><header className="flex items-center justify-between gap-3 text-[.7rem] font-[650] tracking-[.05em] text-brand uppercase"><span>{item.signalType}</span><strong className="text-[.68rem] text-success">{formatConfidence(item.confidence)}</strong></header><p className="my-3 text-[.87rem] leading-[1.6] text-lt-700">{item.claim}</p>{item.observedAt && <time className="mb-2 block text-[.66rem] text-lt-500">Observed {formatDate(item.observedAt, {})}</time>}<a className="inline-flex items-center gap-[5px] text-[.74rem] font-[650] text-brand" href={item.source.url} target="_blank" rel="noreferrer">{item.source.title}<ArrowUpRight size={14}/></a></article>)}</div> : <EmptyState icon={<FileCheck2 size={20}/>} title={discoveryComplete ? 'Extracting source-linked claims' : 'Evidence follows discovery'} body={discoveryComplete ? 'The worker is reading collected sources and normalizing citable claims with confidence scores.' : 'Start discovery above. Claims appear here once the worker extracts them from collected sources.'}/>}
        </WorkspaceSection>
      </div>

      <aside className="sticky top-24 rounded-2xl border border-lt-200 bg-white p-5 max-[950px]:static">
        <p className="mt-0 mb-[17px] text-[.91rem] font-bold text-lt-900">Research context</p>
        <dl className="mt-0 mb-[18px] grid">
          <ContextRow label="Prospect" value={run.prospect.name}/><ContextRow label="Company" value={run.prospect.companyName || 'Not supplied'}/><ContextRow label="Offer" value={run.offer.name}/><ContextRow label="Target persona" value={run.offer.targetPersona || 'Not supplied'}/><ContextRow label="Goal" value={run.goal === 'meeting' ? 'Prepare for a meeting' : 'Create personalized outreach'}/>
        </dl>
        <div><small className="text-[.66rem] tracking-[.07em] text-lt-500 uppercase">Value proposition</small><p className="mt-[7px] mb-[18px] text-[.78rem] leading-[1.55] text-lt-600">{run.offer.valueProposition}</p></div>
        {run.brief && run.status !== 'completed' && <ButtonLink href={`/dashboard/briefs/${run.brief.id}`}>Open conversation brief<ArrowUpRight size={16}/></ButtonLink>}
      </aside>
    </WorkspaceSplit>
  </WorkspacePage>
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 border-b border-lt-100 py-3"><dt className="text-[.66rem] tracking-wider text-lt-500 uppercase">{label}</dt><dd className="m-0 text-sm leading-normal text-lt-900">{value}</dd></div>
}
