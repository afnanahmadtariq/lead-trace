import type { ReactNode } from 'react'
import { DashboardPageHeader } from '../workspace/dashboard-page-header'

export const Bone = ({ className = '' }: { className?: string }) => <div aria-hidden="true" className={`animate-pulse rounded-lg bg-lt-100 motion-reduce:animate-none ${className}`}/>

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return <DashboardPageHeader eyebrow="Loading" title={<Bone className="h-6 w-40"/>} lead={null} action={action ? <Bone className="h-9 w-28 rounded-control"/> : undefined}/>
}

export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-4" role="status" aria-busy="true" aria-label={label}>{children}</div>
}
