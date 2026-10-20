'use client'

import { ArrowRight, Check, MessageCircle, Sparkles, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

const steps = [
  { label: 'Source claim', title: 'A team is growing', body: 'Northstar’s careers page lists enterprise sales roles in two regions.', icon: TrendingUp },
  { label: 'Possible fit', title: 'An angle worth exploring', body: 'If this hiring is still active, consistent onboarding could be relevant to your sales training offer.', icon: Sparkles },
  { label: 'Question to ask', title: 'Make it a conversation', body: 'Is ramping new hires a priority, and how do you measure a successful first month?', icon: MessageCircle },
]

export function DealBriefPreview() {
  const [selected, setSelected] = useState(0)
  const active = steps[selected]
  const Icon = active.icon
  return <div className="relative isolate animate-[riseIn_650ms_90ms_var(--ease-fluid)_both] motion-reduce:animate-none">
    <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full border border-brand-bright/15 bg-[radial-gradient(circle,rgb(89_188_248_/_10%),transparent_68%)] max-sm:-inset-5"/>
    <div className="absolute -top-5 -right-2 z-10 flex items-center gap-1.5 rounded-xl border border-lt-200 bg-white/95 px-3 py-2 text-xs font-semibold text-brand shadow-card"><Sparkles size={15}/>Try a conversation angle</div>
    <article className="overflow-hidden rounded-[22px] border border-lt-200 bg-white shadow-panel" aria-label="Illustrative conversation angle">
      <header className="flex items-center justify-between gap-2 border-b border-lt-100 px-6 py-5"><div className="flex items-center gap-2.5"><Image src="/lead-trace-logo.svg" alt="" width={30} height={30}/><b className="text-xs text-lt-900">Conversation angle</b></div><span className="text-[.6rem] font-medium text-lt-500">Illustrative example</span></header>
      <div className="flex items-center gap-3 px-6 pt-5 pb-4"><span className="grid size-11 place-items-center rounded-[14px] bg-lt-100 text-xs font-bold text-brand">AM</span><div><h2 className="m-0 text-base text-lt-900">Alex Morgan</h2><p className="mt-1 mb-0 text-xs text-lt-500">Northstar Cloud · Sales training offer</p></div></div>
      <div className="grid grid-cols-3 gap-1 px-5" aria-label="Explore the example">{steps.map((step, index) => <button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} key={step.label} className={`min-h-11 rounded-t-xl border-b-2 px-2 text-[.65rem] font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-bright ${selected === index ? 'border-brand-bright bg-lt-100 text-brand' : 'border-lt-100 text-lt-500 hover:text-brand'}`}><span className="mr-1 opacity-60">0{index + 1}</span>{step.label}</button>)}</div>
      <div className="min-h-[202px] px-6 py-6" aria-live="polite"><p className="mt-0 mb-3 flex items-center gap-2 text-xs font-semibold text-brand"><Icon size={17}/>{active.title}</p><p className="m-0 text-base leading-relaxed text-lt-800">{active.body}</p></div>
      <div className="flex items-center justify-between gap-3 bg-lt-950 px-6 py-4"><span className="inline-flex items-center gap-1.5 text-[.66rem] text-lt-200"><Check size={13} className="text-sky"/>You validate the fit</span><button type="button" onClick={() => setSelected((selected + 1) % steps.length)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky">{selected === 2 ? 'Back to the claim' : 'Follow the angle'}<ArrowRight size={14}/></button></div>
    </article>
  </div>
}
