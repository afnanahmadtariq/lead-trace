import type { ReactNode } from 'react'

export function WorkspacePage({ children }: { children: ReactNode }) {
  return <div className="grid animate-page-in gap-6">{children}</div>
}

export function WorkspaceHeader({ eyebrow, title, lead, action }: { eyebrow: string; title: ReactNode; lead: ReactNode; action?: ReactNode }) {
  return <header className="flex items-end justify-between gap-7 max-[620px]:flex-col max-[620px]:items-start">
    <div className="max-w-[720px]">
      <p className="mt-0 mb-2.5 text-[.69rem] font-[650] tracking-[.12em] text-brand-bright uppercase">{eyebrow}</p>
      <h1 className="m-0 text-[clamp(2.2rem,4vw,3.45rem)] leading-[1.04] font-light tracking-[-.055em] text-lt-900 max-[620px]:text-[2.35rem]">{title}</h1>
      <p className="mt-3 mb-0 max-w-[650px] text-[.96rem] leading-[1.6] text-lt-600">{lead}</p>
    </div>
    {action}
  </header>
}

export function WorkspaceSection({ title, description, action, children }: { title: ReactNode; description: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <section className="grid gap-3.5">
    <div className="flex items-center justify-between gap-[18px]">
      <div><h2 className="m-0 text-[1.15rem] tracking-[-.025em] text-lt-900">{title}</h2><p className="mt-1 mb-0 text-[.82rem] text-lt-500">{description}</p></div>
      {action && <span className="text-[.8rem] font-[650] text-brand">{action}</span>}
    </div>
    {children}
  </section>
}

export function WorkspaceSplit({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(260px,.75fr)] items-start gap-[18px] max-[850px]:grid-cols-1">{children}</div>
}
