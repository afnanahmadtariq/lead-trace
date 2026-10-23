import type { ReactNode } from 'react'

export const Bone = ({ className = '' }: { className?: string }) => <div aria-hidden="true" className={`animate-pulse rounded-lg bg-lt-100 motion-reduce:animate-none ${className}`}/>

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return <div className="flex items-end justify-between gap-7 max-[620px]:flex-col max-[620px]:items-start"><div className="grid w-full max-w-[720px] gap-3"><Bone className="h-3 w-20"/><Bone className="h-11 w-3/4"/><Bone className="h-4 w-full max-w-[560px]"/></div>{action && <Bone className="h-12 w-36 rounded-control"/>}</div>
}

export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-6" role="status" aria-busy="true" aria-label={label}>{children}</div>
}
