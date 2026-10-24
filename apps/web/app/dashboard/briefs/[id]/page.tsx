import { ArrowLeft, ArrowUpRight, FileCheck2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { BriefRefreshButton } from '../../../../components/brief-refresh-button'
import { BriefShareButton } from '../../../../components/brief-share-button'
import { BriefSections } from '../../../../components/brief-sections'
import { ConversationPackButton } from '../../../../components/conversation-pack'
import { BriefStatusPoller } from '../../../../components/research-run-poller'
import { SignalTimeline } from '../../../../components/signal-timeline'
import { StatusBadge } from '../../../../components/ui/status-badge'
import { ButtonLink } from '../../../../components/ui/button'
import { UrgencyBadge } from '../../../../components/urgency-badge'
import { WorkspaceHeader, WorkspacePage } from '../../../../components/workspace/workspace-page'
import { briefCitations, briefUrgencyLabel } from '../../../../lib/brief'
import { formatConfidence, formatDate } from '../../../../lib/format'
import type { DealBriefDetail } from '../../../../lib/research'
import { requireFetch } from '../../../../lib/server-auth'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const brief = await requireFetch<DealBriefDetail>(`/deal-briefs/${encodeURIComponent(id)}`)

  const citations = briefCitations(brief.sections, brief.researchRun.evidence)
  const citationIds = new Set(citations.map((item) => item.evidence_id))
  const citedEvidence = brief.researchRun.evidence.filter((item) => citationIds.has(item.id))
  const collectedCount = brief.researchRun.evidence.length
  const exportSections = { ...(brief.sections as object), key_signals: citations }
  const prospect = brief.researchRun.prospect
  const goalLabel = brief.researchRun.goal === 'meeting' ? 'Meeting brief' : 'Outreach brief'
  const urgencyLabel = briefUrgencyLabel(brief.sections)
  const statusLabel = brief.status === 'refreshing' ? 'Refreshing' : brief.status === 'ready' ? 'Ready' : brief.status.replace(/^./, (letter) => letter.toUpperCase())

  return <WorkspacePage>
    <BriefStatusPoller status={brief.status}/>
    <Link className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-lt-600 hover:text-brand" href="/dashboard/briefs"><ArrowLeft size={15}/>All briefs</Link>
    <WorkspaceHeader eyebrow={`${goalLabel} · ${statusLabel}`} title={<>{prospect.name}{prospect.companyName ? ` at ${prospect.companyName}` : ''}</>} lead={brief.status === 'refreshing' ? <>Your existing brief remains available while Lead Trace updates its recommendations. This page refreshes automatically.</> : <>Review the suggested conversation, check its evidence, then make it your own.</>} action={<div className="flex flex-wrap items-center gap-2"><UrgencyBadge label={urgencyLabel}/><StatusBadge status={brief.status}/></div>}/>

    <div className="flex flex-wrap items-center gap-2 text-xs text-lt-600">
      <MetaChip label="Offer" value={brief.researchRun.offer.name}/>
      <MetaChip label="Cited signals" value={String(citedEvidence.length)}/>
      <MetaChip label="Updated" value={formatDate(brief.updatedAt)}/>
      <ConversationPackButton sections={exportSections} goal={brief.researchRun.goal}/>
      <BriefShareButton briefId={brief.id} initialToken={brief.share?.revokedAt ? undefined : brief.share?.token}/>
    </div>

    <main className="grid gap-4">
      <BriefSections sections={brief.sections} goal={brief.researchRun.goal} evidence={brief.researchRun.evidence}/>
      <SignalTimeline evidence={citedEvidence} title="Cited signal timeline"/>

      <details className="group overflow-hidden rounded-[18px] border border-lt-200 bg-white" data-testid="evidence-disclosure">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:hidden">
          <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf8f1] text-success"><ShieldCheck size={19}/></span><span><strong className="block text-sm text-lt-900">Sources & confidence</strong><small className="mt-0.5 block text-xs text-lt-500">{citedEvidence.length} claim{citedEvidence.length === 1 ? '' : 's'} used in this brief</small></span></span>
          <span className="text-xs font-semibold text-brand group-open:hidden">Show evidence</span><span className="hidden text-xs font-semibold text-brand group-open:inline">Hide evidence</span>
        </summary>
        <div className="grid gap-2 border-t border-lt-100 p-4">
          <p className="m-0 pb-2 text-xs leading-relaxed text-lt-600">These are the claims cited in this brief. AI confidence describes the model’s assessment; it does not independently verify the source.</p>
          {citedEvidence.length ? citedEvidence.map((item) => <article className="rounded-[14px] border border-lt-200 bg-lt-50/50 p-4 focus:outline-2 focus:outline-brand-bright focus:outline-offset-2 scroll-mt-24" id={`evidence-${item.id}`} tabIndex={-1} key={item.id}>
            <header className="mb-2 flex items-center justify-between gap-3"><span className="text-[.68rem] font-bold tracking-[.08em] text-brand uppercase">{item.signalType}</span><strong className="text-xs text-success">AI {formatConfidence(item.confidence)}</strong></header>
            <p className="my-0 text-sm leading-relaxed text-lt-700">{item.claim}</p>
            {item.observedAt && <time className="mt-2 block text-xs text-lt-500">Observed {formatDate(item.observedAt, {})}</time>}
            <a className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand" href={item.source.url} target="_blank" rel="noreferrer"><FileCheck2 size={14}/>{item.source.title}<ArrowUpRight size={13}/></a>
          </article>) : <p className="m-0 p-2 text-sm text-lt-500">No citations are attached to this draft yet.</p>}
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lt-200 bg-lt-50 px-5 py-4 text-sm text-lt-600">
        <span>{citedEvidence.length} cited signal{citedEvidence.length === 1 ? '' : 's'} selected from {collectedCount} collected claim{collectedCount === 1 ? '' : 's'}</span>
        <Link className="inline-flex items-center gap-1 font-semibold text-brand" href={`/dashboard/research/${brief.researchRun.id}`}>Explore full research<ArrowUpRight size={14}/></Link>
      </div>

      {brief.status === 'ready' && <BriefRefreshButton runId={brief.researchRun.id} previousSections={brief.previousSections} currentSections={brief.sections}/>}

      {prospect.id && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-lt-100/60 p-5"><div><h2 className="m-0 text-lg text-lt-900">Keep the conversation moving</h2><p className="mt-2 mb-0 max-w-xl text-sm leading-relaxed text-lt-600">After you use this brief, return to {prospect.name} to capture a note, track a deal, or set your next follow-up.</p></div><ButtonLink href={`/dashboard/contacts/${encodeURIComponent(prospect.id)}`} variant="secondary">Open contact & next steps<ArrowUpRight size={15}/></ButtonLink></section>}

      <Link className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-lt-600 hover:text-brand" href={`/dashboard/research/${brief.researchRun.id}`}>View research process<ArrowUpRight size={14}/></Link>
    </main>
  </WorkspacePage>
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return <span className="rounded-full border border-lt-200 bg-white px-3 py-2"><span className="text-lt-500">{label}</span><strong className="ml-1.5 text-lt-900">{value}</strong></span>
}
