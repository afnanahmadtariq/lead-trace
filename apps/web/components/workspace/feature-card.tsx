import Link from 'next/link'
import type { ReactNode } from 'react'

export function FeatureGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-3 gap-[13px] max-[850px]:grid-cols-1">{children}</section>
}

export function FeatureLink({ href, icon, title, body, footer }: { href: string; icon: ReactNode; title: string; body: string; footer: ReactNode }) {
  return <Link href={href} className="grid min-h-[186px] content-between rounded-panel border border-lt-200 bg-white p-[21px] transition-[border-color,box-shadow] duration-300 ease-fluid hover:border-lt-300 hover:shadow-card-hover motion-reduce:transition-none">
    <span className="grid size-[38px] place-items-center rounded-[11px] bg-lt-100 text-brand">{icon}</span>
    <div><h2 className="mt-[22px] mb-[7px] text-[1.03rem] text-lt-900">{title}</h2><p className="m-0 text-[.87rem] leading-[1.55] text-lt-600">{body}</p></div>
    <footer className="mt-[22px] flex items-center justify-between gap-2.5 text-[.77rem] font-[650] text-brand">{footer}</footer>
  </Link>
}
