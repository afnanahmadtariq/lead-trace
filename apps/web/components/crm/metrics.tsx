import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { InfoTip } from '../ui/info-tip'

export type MetricItem = { label: string; value: ReactNode; detail?: ReactNode; hint?: ReactNode; href?: string; tone?: 'default' | 'danger' | 'success' | 'brand' }
const valueTone = { default: 'text-lt-900', danger: 'text-danger', success: 'text-success', brand: 'text-brand' }

function Metric({ label, value, detail, hint, href, tone = 'default' }: MetricItem) {
  const body = <>
    <strong className={`block text-xl leading-tight font-semibold tracking-tight tabular-nums break-words ${valueTone[tone]}`}>{value}</strong>
    <span className="block text-xs font-medium text-lt-700">{label}</span>
    {detail && <span className={`mt-0.5 block text-xs tabular-nums ${valueTone[tone]}`}>{detail}</span>}
  </>
  return <div className="relative flex min-w-0 items-center gap-2 bg-white">
    {href ? <Link href={href} className="group block min-w-0 flex-1 px-4 py-3 pr-9 transition-colors hover:bg-lt-50">{body}<ArrowUpRight size={13} className="absolute top-3 right-3 text-lt-400 transition-colors group-hover:text-brand" aria-hidden="true"/></Link> : <div className="min-w-0 flex-1 px-4 py-3">{body}</div>}
    {hint && <span className={`shrink-0 ${href ? 'absolute right-1 bottom-1' : 'pr-2'}`}><InfoTip label={`About ${label.toLowerCase()}`}>{hint}</InfoTip></span>}
  </div>
}

export function MetricStrip({ items, label }: { items: MetricItem[]; label: string }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-lt-200 bg-lt-200 [&>div]:flex-[1_1_145px]">{items.map((item) => <Metric key={item.label} {...item}/>)}</div>
}
