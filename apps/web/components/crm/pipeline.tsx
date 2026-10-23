'use client'
import Link from 'next/link'
import { useState } from 'react'
import { cardClass, controlClass, label, money, stages, type Deal, type Person } from '../../lib/crm'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'
import { DealForm } from './forms'

export function Pipeline({ deals, members }: { deals: Deal[]; members: Person[] }) {
  const [selected, setSelected] = useState<Deal | null>(null)
  const [stageFilter, setStageFilter] = useState('all')
  const openDeals = deals.filter((deal) => !['won', 'lost'].includes(deal.stage))
  const currencies = [...new Set(openDeals.map((deal) => deal.currency))]
  return <>
    <div className="flex flex-wrap gap-4"><div className={cardClass}><strong className="text-2xl text-lt-900">{openDeals.length}</strong><span className="ml-3 text-sm text-lt-500">Open deals</span></div>{currencies.map((currency) => <div key={currency} className={cardClass}><strong className="text-xl text-lt-900">{money(openDeals.filter((deal) => deal.currency === currency).reduce((sum, deal) => sum + Number(deal.value), 0), currency)}</strong><span className="ml-3 text-sm text-lt-500">Open value</span></div>)}</div>
    {!deals.length && <p className="rounded-2xl border border-dashed border-lt-300 bg-white p-5 text-sm leading-relaxed text-lt-600">Your pipeline starts with a potential sale. Choose Add deal, pick a contact, and give the opportunity a name and value.</p>}
    <label className="grid w-fit min-w-48 gap-2 text-sm font-semibold text-lt-700">Show stage<select className={controlClass} value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All stages</option>{stages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label>
    <div className="flex max-w-full items-start gap-3 overflow-x-auto pb-4 max-[640px]:grid max-[640px]:grid-cols-1" aria-label="Deal pipeline" tabIndex={0}>{stages.filter((stage) => stageFilter === 'all' || stage === stageFilter).map((stage) => {
      const items = deals.filter((deal) => deal.stage === stage)
      return <section className="w-60 shrink-0 rounded-2xl border-t-2 border-brand/30 bg-lt-100/80 p-3 max-[640px]:w-full" key={stage}><h2 className="mt-1 mb-4 flex justify-between text-sm text-lt-700">{label(stage)}<span>{items.length}</span></h2><div className="grid gap-3">{items.map((deal) => <article key={deal.id} className="rounded-xl border border-lt-200 bg-white p-4 shadow-card"><h3 className="mt-0 mb-2 break-words text-sm text-lt-900">{deal.title}</h3><Link className="text-xs text-brand" href={`/dashboard/contacts/${deal.prospectId}`}>{deal.prospect.name}</Link><p className="my-3 text-lg font-semibold text-lt-900">{money(deal.value, deal.currency)}</p><p className="text-xs text-lt-500">{deal.owner?.name || 'Unassigned'}{deal.expectedCloseAt ? ` · Close ${deal.expectedCloseAt.slice(0, 10)}` : ''}</p><Button size="xs" variant="secondary" onClick={() => setSelected(deal)}>Edit deal</Button></article>)}{!items.length && <p className="py-6 text-center text-xs text-lt-500">No deals</p>}</div></section>
    })}</div>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Update deal">{selected && <DealForm key={selected.id} deal={selected} prospectId={selected.prospectId} members={members} onSaved={() => setSelected(null)}/>}</Modal>
    <p className="m-0 text-xs text-lt-500">Showing up to 500 most recently updated deals. Values are grouped by currency.</p>
  </>
}
