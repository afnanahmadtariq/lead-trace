import { ArrowUpRight, FileCheck2, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RevokedSharePage } from '../../../../components/error-page'
import { BriefSections } from '../../../../components/brief-sections'
import { ConversationPackButton } from '../../../../components/conversation-pack'
import { SignalTimeline } from '../../../../components/signal-timeline'
import { Brand } from '../../../../components/ui/brand'
import { briefCitations, briefUrgencyLabel } from '../../../../lib/brief'
import { API_URL } from '../../../../lib/api-client'
import { formatConfidence, formatDate } from '../../../../lib/format'
import type { DealBriefDetail } from '../../../../lib/research'

export const metadata: Metadata = {
  title: 'Shared conversation brief — Lead Trace',
  description: 'A read-only, evidence-backed conversation brief shared from Lead Trace.',
  robots: { index: false, follow: false },
}

type SharedBrief = DealBriefDetail & { sharedAt: string }

async function getSharedBrief(token: string) {
  const response = await fetch(`${API_URL}/shared/briefs/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (response.status === 404) return { status: 'missing' as const }
  if (response.status === 410) return { status: 'revoked' as const }
  if (!response.ok) throw new Error('Lead Trace could not load this shared brief')
  return { status: 'ready' as const, brief: await response.json() as SharedBrief }
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await getSharedBrief(token)
  if (result.status === 'revoked') return <RevokedSharePage/>
  if (result.status === 'missing') notFound()
  const brief = result.brief

  const citations = briefCitations(brief.sections, brief.researchRun.evidence)
  const citationIds = new Set(citations.map((item) => item.evidence_id))
  const citedEvidence = brief.researchRun.evidence.filter((item) => citationIds.has(item.id))
  const exportSections = { ...(brief.sections as object), key_signals: citations }
  const prospect = brief.researchRun.prospect
  const goalLabel = brief.researchRun.goal === 'meeting' ? 'Meeting brief' : 'Outreach brief'

  return <main className="min-h-screen bg-lt-50 text-lt-950">
    <nav className="mx-auto flex w-[min(1160px,calc(100%_-_48px))] items-center justify-between py-5 max-sm:w-[calc(100%_-_36px)]" aria-label="Shared brief navigation">
      <Brand/>
      <Link className="text-sm font-semibold text-brand hover:underline" href="/sign-up">Create your own brief</Link>
    </nav>

    <div className="mx-auto grid w-[min(1040px,calc(100%_-_48px))] gap-6 py-10 pb-20 max-sm:w-[calc(100%_-_36px)] max-sm:py-7">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/15 bg-white px-4 py-3 text-xs text-lt-600 shadow-card">
        <span className="inline-flex items-center gap-2 font-semibold text-brand"><ShareBadge/>Shared read-only brief</span>
        <span>Shared {formatDate(brief.sharedAt)}</span>
      </div>

      <header className="grid gap-3 border-b border-lt-200 pb-7">
        <p className="m-0 text-[.69rem] font-bold tracking-[.12em] text-brand-bright uppercase">{goalLabel} · {briefUrgencyLabel(brief.sections) ?? 'Prepared'}</p>
        <h1 className="m-0 text-[clamp(2.35rem,5vw,4rem)] leading-[1.02] font-light tracking-[-.055em] text-lt-900">{prospect.name}{prospect.companyName ? ` at ${prospect.companyName}` : ''}</h1>
        <p className="m-0 max-w-[700px] text-base leading-relaxed text-lt-600">Review the suggested conversation and open each cited source before using it.</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lt-600">
          <MetaChip label="Offer" value={brief.researchRun.offer.name}/>
          <MetaChip label="Cited signals" value={String(citedEvidence.length)}/>
          <MetaChip label="Updated" value={formatDate(brief.updatedAt)}/>
          <ConversationPackButton sections={exportSections} goal={brief.researchRun.goal}/>
        </div>
      </header>

      <BriefSections sections={brief.sections} goal={brief.researchRun.goal} evidence={brief.researchRun.evidence}/>
      <SignalTimeline evidence={citedEvidence} title="Cited signal timeline"/>

      <details className="group overflow-hidden rounded-[18px] border border-lt-200 bg-white" data-testid="evidence-disclosure">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:hidden">
          <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf8f1] text-success"><ShieldCheck size={19}/></span><span><strong className="block text-sm text-lt-900">Sources & confidence</strong><small className="mt-0.5 block text-xs text-lt-500">{citedEvidence.length} cited claim{citedEvidence.length === 1 ? '' : 's'}</small></span></span>
          <span className="text-xs font-semibold text-brand group-open:hidden">Show evidence</span><span className="hidden text-xs font-semibold text-brand group-open:inline">Hide evidence</span>
        </summary>
        <div className="grid gap-2 border-t border-lt-100 p-4">
          {citedEvidence.map((item) => <article className="rounded-[14px] border border-lt-200 bg-lt-50/50 p-4 focus:outline-2 focus:outline-brand-bright focus:outline-offset-2 scroll-mt-24" id={`evidence-${item.id}`} tabIndex={-1} key={item.id}>
            <header className="mb-2 flex items-center justify-between gap-3"><span className="text-[.68rem] font-bold tracking-[.08em] text-brand uppercase">{item.signalType}</span><strong className="text-xs text-success">AI {formatConfidence(item.confidence)}</strong></header>
            <p className="my-0 text-sm leading-relaxed text-lt-700">{item.claim}</p>
            <a className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand" href={item.source.url} target="_blank" rel="noreferrer"><FileCheck2 size={14}/>{item.source.title}<ArrowUpRight size={13}/></a>
          </article>)}
        </div>
      </details>
    </div>
  </main>
}

function ShareBadge() {
  return <span className="grid size-7 place-items-center rounded-lg bg-lt-100" aria-hidden="true"><ArrowUpRight size={14}/></span>
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return <span className="rounded-full border border-lt-200 bg-white px-3 py-2"><span className="text-lt-500">{label}</span><strong className="ml-1.5 text-lt-900">{value}</strong></span>
}
