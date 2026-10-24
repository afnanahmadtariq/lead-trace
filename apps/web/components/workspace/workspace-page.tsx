import type { ReactNode } from 'react'
import { DashboardPageHeader, type DashboardPageHeaderProps } from './dashboard-page-header'

export function WorkspacePage({ children }: { children: ReactNode }) {
  return <div className="grid animate-page-in gap-4">{children}</div>
}

export function WorkspaceHeader(props: DashboardPageHeaderProps) {
  return <DashboardPageHeader {...props}/>
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
