'use client'
import { Kanban, Table2, Target } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { compactControlClass, dealTotals, label, money, stages, stageTone, type Deal, type Person } from '../../lib/crm'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'
import { StageBadge } from './badges'
import { DeleteButton } from './delete-button'
import { DealForm } from './forms'
import { MetricStrip } from './metrics'

const stageDot = (stage: string) => { const tone = stageTone(stage); return tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : stage === 'new' ? 'bg-lt-500' : 'bg-brand' }

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
  const valueMetrics = currencies.length ? currencies.map((currency) => ({ label: currencies.length > 1 ? `Open value in ${currency}` : 'Open value', value: money(openDeals.filter((deal) => deal.currency === currency).reduce((sum, deal) => sum + Number(deal.value), 0), currency), hint: 'Across open deals' })) : [{ label: 'Open value', value: money(0, 'USD'), hint: 'Across open deals' }]
  return <>
    <MetricStrip label="Pipeline summary" items={[{ label: 'Open deals', value: openDeals.length, hint: 'Still in progress' }, ...valueMetrics, { label: 'Won', value: deals.filter((deal) => deal.stage === 'won').length, tone: 'success', hint: 'Closed as won' }]}/>
    {!deals.length && <div className="flex items-start gap-3 rounded-2xl border border-dashed border-lt-300 bg-white p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lt-100 text-brand"><Target size={19}/></span><p className="m-0 self-center text-sm leading-relaxed text-lt-600">Your pipeline starts with a potential sale. Choose Add deal, pick a contact, and give the opportunity a name and value.</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2.5 text-sm font-semibold whitespace-nowrap text-lt-700">Show stage<select className={`${compactControlClass} min-w-40 font-normal`} value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All stages</option>{stages.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label>
      <div className="flex gap-1 rounded-xl bg-lt-100 p-1" role="group" aria-label="Pipeline view">
        <Button type="button" size="xs" variant={view === 'board' ? 'secondary' : 'ghost'} className={view === 'board' ? 'shadow-card' : ''} aria-label="Board view" aria-pressed={view === 'board'} onClick={() => changeView('board')}><Kanban size={16}/>Board</Button>
        <Button type="button" size="xs" variant={view === 'table' ? 'secondary' : 'ghost'} className={view === 'table' ? 'shadow-card' : ''} aria-label="Table view" aria-pressed={view === 'table'} onClick={() => changeView('table')}><Table2 size={16}/>Table</Button>
      </div>
    </div>
    {view === 'table' ? <PipelineTable deals={visibleDeals} onEdit={setSelected}/> : <div className="flex max-w-full items-stretch gap-3 overflow-x-auto pb-3 max-[640px]:grid max-[640px]:grid-cols-1" aria-label="Deal pipeline" tabIndex={0}>{stages.filter((stage) => stageFilter === 'all' || stage === stageFilter).map((stage) => {
      const items = visibleDeals.filter((deal) => deal.stage === stage), totals = dealTotals(items)
      return <section className="w-64 shrink-0 rounded-2xl border border-lt-100 bg-lt-100/50 p-2.5 max-[640px]:w-full" key={stage}>
        <div className="px-1.5 pt-1 pb-3"><h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-lt-900"><i className={`size-2 rounded-full ${stageDot(stage)}`} aria-hidden="true"/>{label(stage)}<span className="ml-auto rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold text-lt-600 tabular-nums">{items.length}</span></h2><p className="mt-1 mb-0 min-h-4 pl-4 text-xs text-lt-500 tabular-nums">{totals.join(' + ')}</p></div>
        <div className="grid gap-2">{items.map((deal) => <article key={deal.id} className="rounded-xl border border-lt-200 bg-white p-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-lt-300 hover:shadow-card motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <h3 className="m-0 text-sm leading-snug font-semibold break-words text-lt-900">{deal.title}</h3>
          <Link className="mt-1 block truncate text-xs text-lt-600 hover:text-brand" href={`/dashboard/contacts/${deal.prospectId}`}>{deal.prospect.name}</Link>
          <div className="mt-3 flex items-center justify-between gap-2"><p className="m-0 text-base font-semibold text-lt-900 tabular-nums">{money(deal.value, deal.currency)}</p><Button size="xs" variant="ghost" className="-mr-2 min-h-8! shrink-0 px-2.5!" onClick={() => setSelected(deal)}>Edit deal</Button></div>
          <p className="mt-2 mb-0 flex min-w-0 items-center gap-1.5 border-t border-lt-100 pt-2.5 text-xs text-lt-500"><span className="truncate">{deal.owner?.name || 'Unassigned'}</span>{deal.expectedCloseAt && <><i className="size-[3px] shrink-0 rounded-full bg-current" aria-hidden="true"/><span className="whitespace-nowrap tabular-nums">Closes {deal.expectedCloseAt.slice(0, 10)}</span></>}</p>
        </article>)}{!items.length && <p className="m-0 rounded-xl border border-dashed border-lt-300 px-3 py-4 text-center text-xs text-lt-500">No deals</p>}</div>
      </section>
    })}</div>}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Update deal">{selected && <><DealForm key={selected.id} deal={selected} prospectId={selected.prospectId} members={members} onSaved={() => setSelected(null)}/><div className="mt-5 flex items-center justify-between gap-3 border-t border-lt-100 pt-4"><span className="text-xs text-lt-500">Remove this deal from the pipeline.</span><DeleteButton noun="deal" path={`/crm/deals/${selected.id}`} description={`“${selected.title}” will be removed from the pipeline.`} onDeleted={() => setSelected(null)}/></div></>}</Modal>
    <p className="m-0 text-xs text-lt-500">Showing up to 500 most recently updated deals. Values are grouped by currency.</p>
  </>
}

function PipelineTable({ deals, onEdit }: { deals: Deal[]; onEdit: (deal: Deal) => void }) {
  return <><div className="max-w-full overflow-x-auto rounded-2xl border border-lt-200 bg-white" role="region" aria-label="Deals table" tabIndex={0}>
    <table className="w-full min-w-[800px] border-collapse text-left text-sm">
      <caption className="sr-only">Pipeline deals. Select a deal name or its edit button to update it.</caption>
      <thead className="border-b border-lt-200 bg-lt-50 text-xs text-lt-600"><tr>{['Deal', 'Contact', 'Stage', 'Value', 'Owner', 'Expected close', 'Actions'].map((heading) => <th key={heading} scope="col" className={`px-5 py-3 font-semibold ${heading === 'Value' || heading === 'Actions' ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead>
      <tbody>{deals.map((deal) => <tr key={deal.id} className="border-t border-lt-100 transition-colors first:border-t-0 hover:bg-lt-50">
        <th scope="row" className="min-w-48 px-5 py-3.5 font-semibold"><button type="button" className="text-left text-lt-900 hover:text-brand hover:underline" onClick={() => onEdit(deal)}>{deal.title}</button></th>
        <td className="min-w-40 px-5 py-3.5"><Link className="font-medium text-lt-900 hover:text-brand hover:underline" href={`/dashboard/contacts/${deal.prospectId}`}>{deal.prospect.name}</Link>{deal.prospect.companyName && <span className="mt-0.5 block text-xs text-lt-500">{deal.prospect.companyName}</span>}</td>
        <td className="px-5 py-3.5"><StageBadge stage={deal.stage}/></td>
        <td className="px-5 py-3.5 text-right font-semibold whitespace-nowrap text-lt-900 tabular-nums">{money(deal.value, deal.currency)}</td>
        <td className={`px-5 py-3.5 ${deal.owner ? 'text-lt-700' : 'text-lt-500'}`}>{deal.owner?.name || 'Unassigned'}</td>
        <td className="px-5 py-3.5 whitespace-nowrap text-lt-700 tabular-nums">{deal.expectedCloseAt ? <time dateTime={deal.expectedCloseAt.slice(0, 10)}>{deal.expectedCloseAt.slice(0, 10)}</time> : <span className="text-lt-500">Not set</span>}</td>
        <td className="px-5 py-3.5 text-right"><Button type="button" size="xs" variant="secondary" aria-label={`Edit deal: ${deal.title}`} onClick={() => onEdit(deal)}>Edit deal</Button></td>
      </tr>)}{!deals.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-lt-600">No deals in this view. Choose another stage or add a deal to get started.</td></tr>}</tbody>
    </table>
  </div><p className="m-0 hidden text-xs text-lt-600 max-[640px]:block">Scroll across the table to see all columns.</p></>
}
