'use client'

import { ArrowUpRight, Lightbulb, MessageCircle, Quote } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import type { BriefCitation, ConversationAngle } from '../lib/brief'
import { CopyButton } from './ui/copy-button'

export function ConversationAngles({ angles, citations }: { angles: ConversationAngle[]; citations: BriefCitation[] }) {
  const [selected, setSelected] = useState(0)
  const id = useId()
  const usable = angles.flatMap((angle) => {
    const citation = citations.find((item) => item.evidence_id === angle.evidence_id)
    return citation ? [{ ...angle, citation }] : []
  })
  const activeIndex = Math.min(selected, Math.max(usable.length - 1, 0))
  const active = usable[activeIndex]
  if (!active) return null

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % usable.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + usable.length) % usable.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = usable.length - 1
    else return
    event.preventDefault()
    setSelected(next)
    document.getElementById(`${id}-tab-${next}`)?.focus()
  }

  return <section className="overflow-hidden rounded-[22px] border border-brand-bright/25 bg-white shadow-card" aria-label="Conversation angles">
    <header className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6 pb-5 max-[620px]:px-5">
      <div><p className="mt-0 mb-2 flex items-center gap-2 text-[.68rem] font-bold tracking-[.12em] text-brand uppercase"><Lightbulb size={15}/>Your conversation angles</p><h2 className="m-0 text-[1.45rem] font-medium tracking-[-.035em] text-lt-950">Connect the signal to your offer</h2></div>
      <p className="m-0 max-w-[320px] text-xs leading-relaxed text-lt-500">Start with a source claim. Explore a possible fit. Ask a question that tests it.</p>
    </header>
    <div role="tablist" aria-label="Choose a conversation angle" className="grid auto-cols-fr grid-flow-col gap-1 border-y border-lt-200 bg-lt-50 p-1.5">
      {usable.map((angle, index) => <button type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={index === activeIndex} tabIndex={index === activeIndex ? 0 : -1} key={angle.evidence_id} onClick={() => setSelected(index)} onKeyDown={(event) => navigate(event, index)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 max-[620px]:flex-col max-[620px]:gap-1 max-[620px]:px-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-brand-bright ${index === activeIndex ? 'bg-white text-brand shadow-card' : 'text-lt-500 hover:bg-white/70 hover:text-lt-800'}`}><span className={`grid size-6 place-items-center rounded-full text-[.65rem] ${index === activeIndex ? 'bg-brand text-white' : 'bg-lt-200 text-lt-600'}`}>{String(index + 1).padStart(2, '0')}</span><span className="capitalize">{angle.citation.signal_type.replace(/-/g, ' ')}</span></button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${activeIndex}`} tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-brand-bright focus-visible:-outline-offset-2">
      <div className="grid grid-cols-2 max-[760px]:grid-cols-1">
        <div className="border-r border-lt-200 p-6 max-[760px]:border-r-0 max-[760px]:border-b max-[620px]:p-5"><p className="mt-0 mb-3 flex items-center gap-2 text-[.68rem] font-bold tracking-[.09em] text-brand uppercase"><Quote size={15}/>Source claim</p><p className="m-0 text-base leading-relaxed text-lt-900">{active.citation.claim}</p><a href={active.citation.source_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">Read the source<ArrowUpRight size={14}/></a></div>
        <div className="bg-[#f2f8fd] p-6 max-[620px]:p-5"><p className="mt-0 mb-3 text-[.68rem] font-bold tracking-[.09em] text-brand uppercase">Why it could matter</p><p className="m-0 text-sm leading-relaxed text-lt-800">{active.why_it_matters}</p><span className="mt-5 inline-block rounded-full border border-lt-300 px-2.5 py-1 text-[.65rem] font-medium text-lt-600">Hypothesis to validate</span></div>
      </div>
      <div className="flex items-start gap-3 border-t border-lt-200 bg-lt-950 px-6 py-5 text-white max-[620px]:px-5"><MessageCircle className="mt-0.5 shrink-0 text-sky" size={20}/><div className="min-w-0 flex-1"><p className="mt-0 mb-1.5 text-[.65rem] font-bold tracking-[.1em] text-sky uppercase">Ask in the conversation</p><p className="m-0 text-sm leading-relaxed">{active.question}</p><div className="mt-4"><CopyButton value={active.question} label="Copy this question"/></div></div></div>
    </div>
  </section>
}
