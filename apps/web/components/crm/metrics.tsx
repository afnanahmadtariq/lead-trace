import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type MetricItem = { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: 'default' | 'danger' | 'success' | 'brand' }
const valueTone = { default: 'text-lt-900', danger: 'text-danger', success: 'text-success', brand: 'text-brand' }

function Metric({ label, value, hint, href, tone = 'default' }: MetricItem) {
  const body = <>
    <strong className={`block text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums break-words ${valueTone[tone]}`}>{value}</strong>
    <span className="mt-2 block text-sm font-medium text-lt-700">{label}</span>
    {hint && <span className="mt-1 block text-xs leading-relaxed text-lt-500">{hint}</span>}
  </>
  if (!href) return <div className="bg-white p-5">{body}</div>
  return <Link href={href} className="group relative block bg-white p-5 transition-colors hover:bg-lt-50">{body}<ArrowUpRight size={15} className="absolute top-4 right-4 text-lt-300 transition-colors group-hover:text-brand" aria-hidden="true"/></Link>
}

export function MetricStrip({ items, label }: { items: MetricItem[]; label: string }) {
  return <div role="group" aria-label={label} className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden rounded-2xl border border-lt-200 bg-lt-200 max-[620px]:grid-cols-1">{items.map((item) => <Metric key={item.label} {...item}/>)}</div>
}
