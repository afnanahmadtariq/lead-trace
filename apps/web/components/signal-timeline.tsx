import { ArrowUpRight } from 'lucide-react'
import { formatConfidence, formatDate } from '../lib/format'
import type { ResearchEvidenceItem } from '../lib/research'

export function SignalTimeline({ evidence, title = 'Signal timeline' }: { evidence: ResearchEvidenceItem[]; title?: string }) {
  const sorted = [...evidence].sort((left, right) => {
    const leftTime = Date.parse(left.observedAt || '') || 0
    const rightTime = Date.parse(right.observedAt || '') || 0
    return rightTime - leftTime
  })

  if (!sorted.length) return null

  return <section className="rounded-[18px] border border-lt-200 bg-white p-5">
    <header className="mb-4"><h2 className="m-0 text-base text-lt-900">{title}</h2><p className="mt-1 mb-0 text-xs text-lt-500">Evidence sorted by when the signal was observed.</p></header>
    <ol className="relative m-0 grid gap-0 p-0 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:-translate-x-1/2 before:bg-lt-200">
      {sorted.map((item) => <li className="grid grid-cols-[24px_1fr] gap-3 py-3" key={item.id}>
        <span className="relative z-1 grid size-6 place-items-center" aria-hidden="true"><span className="size-[10px] rounded-full bg-brand ring-4 ring-white"/></span>
        <article>
          <header className="mb-1.5 flex flex-wrap items-center gap-2"><span className="rounded-full bg-lt-100 px-2 py-1 text-[.64rem] font-bold tracking-[.06em] text-brand uppercase">{item.signalType}</span><strong className="text-xs text-success">AI {formatConfidence(item.confidence)}</strong>{item.observedAt && <time className="text-[.68rem] text-lt-500">{formatDate(item.observedAt, {})}</time>}</header>
          <p className="m-0 text-sm leading-relaxed text-lt-700">{item.claim}</p>
          <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand" href={item.source.url} target="_blank" rel="noreferrer">{item.source.title}<ArrowUpRight size={12}/></a>
        </article>
      </li>)}
    </ol>
  </section>
}
