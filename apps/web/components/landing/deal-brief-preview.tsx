'use client'

import { ArrowRight, MessageCircle, Sparkles, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

const steps = [
  { label: 'Source claim', title: 'A team is growing', body: 'Northstar’s careers page lists enterprise sales roles in two regions.', icon: TrendingUp },
  { label: 'Possible fit', title: 'An angle worth exploring', body: 'If this hiring is still active, consistent onboarding could be relevant to your sales training offer.', icon: Sparkles },
  { label: 'Question to ask', title: 'Make it a conversation', body: 'Is ramping new hires a priority, and how do you measure a successful first month?', icon: MessageCircle },
]

const citations = [
  { cited: true, text: 'northstar.example/careers' },
  { cited: false, text: 'Hypothesis built on the source claim. Not a fact.' },
  { cited: false, text: 'Tests the hypothesis with the prospect.' },
]

export function DealBriefPreview() {
  const [selected, setSelected] = useState(0)
  const active = steps[selected]
  const citation = citations[selected]
  const Icon = active.icon
  return <div className="animate-[riseIn_650ms_90ms_var(--ease-fluid)_both] motion-reduce:animate-none">
    <article className="overflow-hidden rounded-xl border border-lt-200 bg-white shadow-[0_1px_2px_rgb(16_38_79_/_5%),0_12px_32px_rgb(16_38_79_/_5%)]" aria-label="Conversation angle preview">
      <header className="flex items-center justify-between gap-2 border-b border-lt-200 px-5 py-4"><div className="flex items-center gap-2.5"><Image src="/lead-trace-logo-padded.svg" alt="" width={26} height={26}/><b className="text-sm font-semibold text-lt-900">Conversation angle</b></div><span className="text-xs text-lt-500">Sample data</span></header>
      <div className="px-5 pt-5 pb-4"><p className="m-0 text-base font-semibold text-lt-900">Alex Morgan</p><p className="mt-0.5 mb-0 text-sm text-lt-600">Northstar Cloud, selling sales training</p></div>
      <div className="grid grid-cols-3 border-b border-lt-200 px-5" aria-label="Explore the conversation angle">{steps.map((step, index) => <button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} key={step.label} className={`-mb-px min-h-11 border-b-2 px-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${selected === index ? 'border-brand text-brand' : 'border-transparent text-lt-600 hover:text-lt-900'}`}>{step.label}</button>)}</div>
      <div className="min-h-[188px] px-5 py-5" aria-live="polite"><p className="mt-0 mb-3 flex items-center gap-2 text-sm font-semibold text-brand"><Icon size={16} aria-hidden="true"/>{active.title}</p><p className="m-0 text-base leading-relaxed text-lt-800">{active.body}{citation.cited && <sup className="ml-0.5 text-[.65rem] font-semibold text-brand">1</sup>}</p><p className="mt-5 mb-0 border-t border-lt-100 pt-3 text-xs text-lt-600">{citation.cited && <sup className="mr-1 font-semibold text-brand">1</sup>}{citation.text}</p></div>
      <div className="flex items-center justify-between gap-3 border-t border-lt-200 bg-lt-50 px-5 py-3"><span className="text-xs text-lt-600">You validate the fit</span><button type="button" onClick={() => setSelected((selected + 1) % steps.length)} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-semibold text-brand transition-colors hover:text-lt-900 focus-visible:outline-2 focus-visible:outline-brand">{selected === 2 ? 'Back to the claim' : 'Follow the angle'}<ArrowRight size={14} aria-hidden="true"/></button></div>
    </article>
  </div>
}
