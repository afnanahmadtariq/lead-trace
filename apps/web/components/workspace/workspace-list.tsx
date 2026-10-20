import Link from 'next/link'
import type { ReactNode } from 'react'

export function WorkspaceList({ children }: { children: ReactNode }) {
  return <div className="grid gap-[9px]">{children}</div>
}

export function WorkspaceListLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="flex min-h-[82px] items-center gap-[15px] rounded-[14px] border border-lt-200 bg-white px-[17px] py-[15px] transition-[border-color,background-color,box-shadow] duration-300 ease-fluid hover:border-lt-300 hover:bg-lt-50/50 hover:shadow-card motion-reduce:transition-none max-[620px]:flex-wrap max-[620px]:items-start">{children}</Link>
}

export function ItemIcon({ children }: { children: ReactNode }) {
  return <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-lt-100 text-brand">{children}</span>
}

export function ItemBody({ title, description, heading = 'h3' }: { title: ReactNode; description: ReactNode; heading?: 'h2' | 'h3' }) {
  const Heading = heading
  return <div className="min-w-0 flex-1"><Heading className="mt-0 mb-1 truncate text-[.94rem] text-lt-900">{title}</Heading><p className="m-0 truncate text-[.8rem] text-lt-500">{description}</p></div>
}

export function ItemMeta({ children }: { children: ReactNode }) {
  return <div className="grid shrink-0 justify-items-end gap-1.5 text-[.72rem] text-lt-500 max-[620px]:w-full max-[620px]:grid-flow-col max-[620px]:justify-between max-[620px]:justify-items-start max-[620px]:pl-[53px]">{children}</div>
}
