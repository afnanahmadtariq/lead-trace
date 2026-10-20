'use client'

import { Check, CircleDashed, FileCheck2, Search, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatConfidence, formatDate } from '../lib/format'
import type { ResearchEvidenceItem, ResearchRunDetail } from '../lib/research'

type LiveProps = {
  status: ResearchRunDetail['status']
  discoveryComplete: boolean
  evidenceComplete: boolean
  briefStatus?: string | null
  sourceCount: number
  evidenceCount: number
  evidence: ResearchEvidenceItem[]
}

export function ResearchRunLive({
  status,
  discoveryComplete,
  evidenceComplete,
  briefStatus,
  sourceCount,
  evidenceCount,
  evidence,
}: LiveProps) {
  const briefReady = briefStatus === 'ready'
  const briefRefreshing = briefStatus === 'refreshing'
  const showProgress = status !== 'completed' || !briefReady
  if (!showProgress) return null

  const activeStep = status === 'running' ? !discoveryComplete ? 2 : !evidenceComplete ? 3 : !briefReady ? 4 : null : null
  const sourceDescription = discoveryComplete
    ? `${sourceCount} sources found.`
    : status === 'queued'
      ? 'Ready when you start discovery.'
      : status === 'failed'
        ? 'No sources collected.'
        : 'Searching public sources.'
  const evidenceDescription = evidenceComplete
    ? `${evidenceCount} claims extracted.`
    : status === 'failed'
      ? 'Waiting for a successful retry.'
      : discoveryComplete
        ? 'Checking relevance and citations.'
        : 'Starts after web research.'
  const briefDescription = briefRefreshing
    ? 'Updating recommendations.'
    : briefReady
      ? 'Ready to use.'
      : status === 'failed'
        ? 'Waiting for a successful retry.'
        : evidenceComplete
          ? 'Turning signals into recommendations.'
          : 'Built from source-linked signals.'

  return <>
    <section className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-lt-200 bg-lt-200 sm:grid-cols-2 lg:grid-cols-4">
      <RunMetric label="Public sources" value={sourceCount}/>
      <RunMetric label="Evidence claims" value={evidenceCount}/>
      <RunMetric label="Brief" value={briefRefreshing ? 'Refreshing' : briefReady ? 'Ready' : 'Pending'}/>
      <RunMetric label="Status" value={status}/>
    </section>

    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[950px]:grid-cols-4" aria-label="Research workflow">
      <WorkflowStep number="01" title="Input" description="Prospect and offer saved." complete active={false} icon={<Check size={16}/>}/>
      <WorkflowStep number="02" title="Web research" description={sourceDescription} complete={discoveryComplete} active={activeStep === 2} icon={discoveryComplete ? <Check size={16}/> : <Search size={16}/>}/>
      <WorkflowStep number="03" title="Signal check" description={evidenceDescription} complete={evidenceComplete} active={activeStep === 3} icon={evidenceComplete ? <Check size={16}/> : <FileCheck2 size={16}/>}/>
      <WorkflowStep number="04" title="Conversation brief" description={briefDescription} complete={briefReady} active={activeStep === 4} icon={briefReady ? <Check size={16}/> : <Sparkles size={16}/>}/>
    </section>

    {status === 'running' && evidence.length > 0 && <section className="grid gap-2" aria-label="Live evidence preview">
      <p className="m-0 text-[.72rem] font-bold tracking-[.08em] text-brand uppercase">Signals as they land</p>
      <div className="grid gap-2">{evidence.slice(-3).map((item) => <article className="rounded-[14px] border border-lt-200 bg-white p-4" key={item.id}>
        <header className="mb-2 flex items-center justify-between gap-3 text-[.68rem] font-[650] tracking-[.05em] text-brand uppercase"><span>{item.signalType}</span><strong className="text-[.68rem] text-success">{formatConfidence(item.confidence)}</strong></header>
        <p className="m-0 text-[.84rem] leading-[1.55] text-lt-700">{item.claim}</p>
        {item.observedAt && <time className="mt-2 block text-[.66rem] text-lt-500">{formatDate(item.observedAt, { year: undefined })}</time>}
      </article>)}</div>
    </section>}
  </>
}

function RunMetric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="bg-white p-[18px]"><small className="mb-2 block text-[.68rem] tracking-wider text-lt-500 uppercase">{label}</small><strong className="text-sm text-lt-900 capitalize">{value}</strong></div>
}

function WorkflowStep({ number, title, description, complete, active, icon }: { number: string; title: string; description: string; complete: boolean; active: boolean; icon: ReactNode }) {
  return <article className={`flex min-h-[125px] gap-3 rounded-[15px] border bg-white/70 p-4 transition-[border-color,box-shadow] duration-500 motion-reduce:transition-none ${active ? 'border-brand/40 shadow-[0_0_0_1px_rgba(23,104,199,.12)]' : 'border-lt-200'} ${active && !complete ? 'animate-pulse motion-reduce:animate-none' : ''}`} data-active={active || undefined} data-complete={complete || undefined}>
    <span className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${complete ? 'bg-[#eaf8f1] text-success' : active ? 'bg-brand/10 text-brand' : 'bg-[#f1f4f9] text-lt-500'}`}>{active && !complete ? <CircleDashed className="animate-spin motion-reduce:animate-none" size={16}/> : icon}</span>
    <div><small className="text-[.62rem] tracking-wider text-lt-500">{number}</small><strong className="mt-1 mb-1 block text-sm text-lt-900">{title}</strong><p className="m-0 text-xs leading-normal text-lt-500">{description}</p></div>
  </article>
}
