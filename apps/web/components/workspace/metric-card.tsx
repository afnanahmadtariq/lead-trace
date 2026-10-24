import type { ReactNode } from 'react'

export function MetricGrid({ children, label }: { children: ReactNode; label?: string }) {
  return <section className="grid grid-cols-4 gap-3 max-[850px]:grid-cols-2" aria-label={label}>{children}</section>
}

export function MetricCard({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: ReactNode }) {
  return <article className="flex min-w-0 items-center gap-2.5 rounded-xl border border-lt-200 bg-white px-3.5 py-3">
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lt-100 text-brand" aria-hidden="true">{icon}</span>
    <div className="min-w-0"><strong className="block text-xl leading-tight font-semibold tracking-tight text-lt-900">{value}</strong><small className="block text-xs leading-snug text-lt-600">{label}</small></div>
  </article>
}
