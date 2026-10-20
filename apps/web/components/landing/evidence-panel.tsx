import { Check } from 'lucide-react'

const evidence = [
  ['Company careers page', '14 enterprise roles added across EMEA and APAC'],
  ['Company newsroom', 'Expansion announced into two new markets'],
  ['Public executive profile', 'Revenue leader prioritizing repeatable systems'],
]

export function EvidencePanel() {
  return <div className="rounded-[20px] border border-lt-200 bg-white p-6 shadow-panel max-sm:p-[18px]" data-reveal>
    <header className="flex items-center justify-between border-b border-lt-100 pb-4 text-sm font-semibold text-lt-700"><span>Evidence trail</span><b className="text-xs text-brand-bright">Illustrative example</b></header>
    {evidence.map(([title, description], index) => <article className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-lt-100 px-0.5 py-4 max-sm:grid-cols-[auto_1fr]" key={title}>
      <span className="text-[.66rem] text-lt-500">0{index + 1}</span>
      <div><b className="text-sm text-lt-800">{title}</b><p className="mt-1 mb-0 text-xs text-lt-500">{description}</p></div>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#edf9f4] px-2 py-1 text-[.6rem] font-semibold text-success max-sm:hidden"><Check size={11}/> Source claim</span>
    </article>)}
    <div className="mt-4 rounded-xl bg-[linear-gradient(135deg,#f0f8ff,#f5f8ff)] p-4"><span className="text-[.62rem] font-semibold tracking-wider text-brand-bright uppercase">Hypothesis to validate</span><p className="mt-2 mb-0 text-sm leading-relaxed text-lt-700">If the expansion is still active, consistent onboarding may be worth discussing. Ask which part of the ramp-up process needs attention.</p></div>
  </div>
}
