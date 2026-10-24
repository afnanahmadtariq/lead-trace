const evidence = [
  { domain: 'northstar.example/careers', source: 'Company careers page', claim: '14 enterprise roles added across EMEA and APAC' },
  { domain: 'northstar.example/newsroom', source: 'Company newsroom', claim: 'Expansion announced into two new markets' },
  { domain: 'profiles.example/alex-morgan', source: 'Public executive profile', claim: 'Revenue leader prioritizing repeatable systems' },
]

export function EvidencePanel() {
  return <div className="rounded-xl border border-lt-200 bg-white shadow-[0_1px_2px_rgb(16_38_79_/_5%)]" data-reveal>
    <header className="flex items-center justify-between gap-3 border-b border-lt-200 px-6 py-4 text-sm max-sm:px-4"><span className="font-semibold text-lt-900">Evidence trail</span><span className="text-xs text-lt-500">Sample data</span></header>
    <ol className="m-0 list-none p-0">
      {evidence.map(({ domain, source, claim }, index) => <li className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 border-b border-lt-100 px-6 py-4 max-sm:grid-cols-1 max-sm:px-4" key={domain}>
        <p className="m-0 text-[.95rem] leading-snug text-lt-900">{claim}<sup className="ml-0.5 text-[.65rem] font-semibold text-brand">{index + 1}</sup></p>
        <span className="text-xs font-medium text-success max-sm:order-3">Source claim</span>
        <p className="m-0 text-xs text-lt-600">{source}, <span className="break-all underline decoration-lt-300 underline-offset-2">{domain}</span></p>
      </li>)}
    </ol>
    <div className="m-4 border-l-2 border-dashed border-brand/50 bg-lt-50 px-4 py-3 max-sm:mx-3"><p className="m-0 text-xs font-semibold text-lt-700">Hypothesis to validate</p><p className="mt-1.5 mb-0 text-sm leading-relaxed text-lt-700">If the expansion is still active, consistent onboarding may be worth discussing. Ask which part of the ramp-up process needs attention.</p></div>
  </div>
}
