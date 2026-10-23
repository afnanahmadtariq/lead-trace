'use client'
import { Kanban, Table2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cardClass, controlClass, label, money, stages, type Deal, type Person } from '../../lib/crm'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'
import { DealForm } from './forms'

export function Pipeline({ deals, members }: { deals: Deal[]; members: Person[] }) {
  const [selected, setSelected] = useState<Deal | null>(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [view, setView] = useState<'board' | 'table'>('board')
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (window.localStorage.getItem('lead-trace-pipeline-view') === 'table') setView('table')
      } catch { /* The view toggle still works when browser storage is unavailable. */ }
    })
  }, [])
  function changeView(next: 'board' | 'table') {
    setView(next)
    try { window.localStorage.setItem('lead-trace-pipeline-view', next) } catch { /* Keep the selection for this visit. */ }
  }
  const visibleDeals = deals.filter((deal) => stageFilter === 'all' || deal.stage === stageFilter)
  const openDeals = deals.filter((deal) => !['won', 'lost'].includes(deal.stage))
  const currencies = [...new Set(openDeals.map((deal) => deal.currency))]
  return <>
    <div className="flex flex-wrap gap-4"><div className={cardClass}><strong className="text-2xl text-lt-900">{openDeals.length}</strong><span className="ml-3 text-sm text-lt-500">Open deals</span></div>{currencies.map((currency) => <div key={currency} className={cardClass}><strong className="text-xl text-lt-900">{money(openDeals.filter((deal) => deal.currency === currency).reduce((sum, deal) => sum + Number(deal.value), 0), currency)}</strong><span className="ml-3 text-sm text-lt-500">Open value</span></div>)}</div>
    {!deals.length && <p className="rounded-2xl border border-dashed border-lt-300 bg-white p-5 text-sm leading-relaxed text-lt-600">Your pipeline starts with a potential sale. Choose Add deal, pick a contact, and give the opportunity a name and value.</p>}
    <div className="flex flex-wrap items-end justify-between gap-4">
      <label className="grid w-fit min-w-48 gap-2 text-sm font-semibold text-lt-700">Show stage<select className={controlClass} value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All stages</option>{stages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label>
      <div className="flex gap-1 rounded-xl border border-lt-200 bg-white p-1" role="group" aria-label="Pipeline view">
        <Button type="button" size="xs" variant={view === 'board' ? 'primary' : 'ghost'} aria-label="Board view" aria-pressed={view === 'board'} onClick={() => changeView('board')}><Kanban size={16}/>Board</Button>
        <Button type="button" size="xs" variant={view === 'table' ? 'primary' : 'ghost'} aria-label="Table view" aria-pressed={view === 'table'} onClick={() => changeView('table')}><Table2 size={16}/>Table</Button>
      </div>
    </div>
    {view === 'table' ? <PipelineTable deals={visibleDeals} onEdit={setSelected}/> : <div className="flex max-w-full items-start gap-3 overflow-x-auto pb-4 max-[640px]:grid max-[640px]:grid-cols-1" aria-label="Deal pipeline" tabIndex={0}>{stages.filter((stage) => stageFilter === 'all' || stage === stageFilter).map((stage) => {
      const items = visibleDeals.filter((deal) => deal.stage === stage)
      return <section className="w-60 shrink-0 rounded-2xl border-t-2 border-brand/30 bg-lt-100/80 p-3 max-[640px]:w-full" key={stage}><h2 className="mt-1 mb-4 flex justify-between text-sm text-lt-700">{label(stage)}<span>{items.length}</span></h2><div className="grid gap-3">{items.map((deal) => <article key={deal.id} className="rounded-xl border border-lt-200 bg-white p-4 shadow-card"><h3 className="mt-0 mb-2 break-words text-sm text-lt-900">{deal.title}</h3><Link className="text-xs text-brand" href={`/dashboard/contacts/${deal.prospectId}`}>{deal.prospect.name}</Link><p className="my-3 text-lg font-semibold text-lt-900">{money(deal.value, deal.currency)}</p><p className="text-xs text-lt-500">{deal.owner?.name || 'Unassigned'}{deal.expectedCloseAt ? ` · Close ${deal.expectedCloseAt.slice(0, 10)}` : ''}</p><Button size="xs" variant="secondary" onClick={() => setSelected(deal)}>Edit deal</Button></article>)}{!items.length && <p className="py-6 text-center text-xs text-lt-500">No deals</p>}</div></section>
    })}</div>}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Update deal">{selected && <DealForm key={selected.id} deal={selected} prospectId={selected.prospectId} members={members} onSaved={() => setSelected(null)}/>}</Modal>
    <p className="m-0 text-xs text-lt-500">Showing up to 500 most recently updated deals. Values are grouped by currency.</p>
  </>
}

function PipelineTable({ deals, onEdit }: { deals: Deal[]; onEdit: (deal: Deal) => void }) {
  return <><div className="max-w-full overflow-x-auto rounded-2xl border border-lt-200 bg-white" role="region" aria-label="Deals table" tabIndex={0}>
    <table className="w-full min-w-[800px] border-collapse text-left text-sm">
      <caption className="sr-only">Pipeline deals. Select a deal name or its edit button to update it.</caption>
      <thead className="bg-lt-100 text-xs text-lt-600"><tr>{['Deal', 'Contact', 'Stage', 'Value', 'Owner', 'Expected close', 'Actions'].map((heading) => <th key={heading} scope="col" className={`px-5 py-3 font-semibold ${heading === 'Value' ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead>
      <tbody>{deals.map((deal) => <tr key={deal.id} className="border-t border-lt-100 hover:bg-lt-50">
        <th scope="row" className="min-w-48 px-5 py-4 font-semibold"><button type="button" className="text-left text-brand hover:underline" onClick={() => onEdit(deal)}>{deal.title}</button></th>
        <td className="min-w-40 px-5 py-4"><Link className="font-medium text-brand hover:underline" href={`/dashboard/contacts/${deal.prospectId}`}>{deal.prospect.name}</Link>{deal.prospect.companyName && <span className="mt-1 block text-xs text-lt-600">{deal.prospect.companyName}</span>}</td>
        <td className="px-5 py-4"><span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${deal.stage === 'won' ? 'bg-[#eef9f3] text-success' : deal.stage === 'lost' ? 'bg-[#fff0f2] text-danger' : 'bg-lt-100 text-brand'}`}>{label(deal.stage)}</span></td>
        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-lt-900">{money(deal.value, deal.currency)}</td>
        <td className="px-5 py-4 text-lt-600">{deal.owner?.name || 'Unassigned'}</td>
        <td className="whitespace-nowrap px-5 py-4 text-lt-600">{deal.expectedCloseAt ? <time dateTime={deal.expectedCloseAt.slice(0, 10)}>{deal.expectedCloseAt.slice(0, 10)}</time> : 'Not set'}</td>
        <td className="px-5 py-4"><Button type="button" size="xs" variant="secondary" aria-label={`Edit deal: ${deal.title}`} onClick={() => onEdit(deal)}>Edit deal</Button></td>
      </tr>)}{!deals.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-lt-600">No deals in this view. Choose another stage or add a deal to get started.</td></tr>}</tbody>
    </table>
  </div><p className="m-0 hidden text-xs text-lt-600 max-[640px]:block">Scroll across the table to see all columns.</p></>
}
