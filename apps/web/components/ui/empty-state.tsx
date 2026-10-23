import type { ReactNode } from 'react'

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="grid justify-items-center gap-[11px] rounded-panel border border-dashed border-lt-300 bg-white/58 px-6 py-[46px] text-center text-lt-600">
    <span className="grid size-[43px] place-items-center rounded-[13px] bg-lt-100 text-brand">{icon}</span>
    <h2 className="mt-1 mb-0 text-[1.05rem] text-lt-900">{title}</h2>
    <p className="m-0 max-w-[440px] text-[.87rem] leading-[1.55]">{body}</p>
    {action && <span className="mt-[7px] text-[.82rem] font-[650] text-brand">{action}</span>}
  </div>
}
