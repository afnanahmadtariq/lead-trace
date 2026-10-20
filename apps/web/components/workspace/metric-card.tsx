import type { ReactNode } from 'react'

export function MetricGrid({ children, label }: { children: ReactNode; label?: string }) {
  return <section className="grid grid-cols-4 gap-3 max-[850px]:grid-cols-2" aria-label={label}>{children}</section>
}

export function MetricCard({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: ReactNode }) {
  return <article className="grid min-h-[132px] content-between rounded-panel border border-lt-200 bg-white p-[19px] shadow-card max-[620px]:min-h-[115px]">
    <span className="grid size-[35px] place-items-center rounded-[10px] bg-lt-100 text-brand">{icon}</span>
    <div className="flex items-baseline justify-between gap-2.5"><strong className="text-[1.65rem] font-semibold tracking-[-.04em] text-lt-900">{value}</strong><small className="text-[.73rem] text-lt-500">{label}</small></div>
  </article>
}
