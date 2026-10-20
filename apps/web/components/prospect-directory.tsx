'use client'

import Link from 'next/link'
import { ArrowUpDown, Search, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate } from '../lib/format'
import { briefUrgencyLabel } from '../lib/brief'
import type { ResearchRunSummary } from '../lib/research'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { StatusBadge } from './ui/status-badge'
import { UrgencyBadge } from './urgency-badge'
import { WorkspaceSection } from './workspace/workspace-page'
import { ItemBody, ItemIcon, ItemMeta, WorkspaceList, WorkspaceListLink } from './workspace/workspace-list'

type StatusFilter = 'all' | ResearchRunSummary['status']
type GoalFilter = 'all' | ResearchRunSummary['goal']
type SortOption = 'newest' | 'oldest' | 'prospect' | 'company' | 'evidence'

const statuses: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

function searchableText(run: ResearchRunSummary) {
  return [run.prospect.name, run.prospect.companyName, run.prospect.email, run.offer.name, run.offer.targetPersona]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return (left || '').localeCompare(right || '', undefined, { sensitivity: 'base' })
}

export function ProspectDirectory({ runs }: { runs: ResearchRunSummary[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [goal, setGoal] = useState<GoalFilter>('all')
  const [sort, setSort] = useState<SortOption>('newest')

  const totals = useMemo(() => ({
    all: runs.length,
    queued: runs.filter((run) => run.status === 'queued').length,
    running: runs.filter((run) => run.status === 'running').length,
    completed: runs.filter((run) => run.status === 'completed').length,
    failed: runs.filter((run) => run.status === 'failed').length,
  }), [runs])

  const visibleRuns = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const filtered = runs.filter((run) => {
      if (status !== 'all' && run.status !== status) return false
      if (goal !== 'all' && run.goal !== goal) return false
      return !normalizedQuery || searchableText(run).includes(normalizedQuery)
    })

    return filtered.sort((left, right) => {
      if (sort === 'oldest') return Date.parse(left.requestedAt) - Date.parse(right.requestedAt)
      if (sort === 'prospect') return compareText(left.prospect.name, right.prospect.name)
      if (sort === 'company') return compareText(left.prospect.companyName, right.prospect.companyName) || compareText(left.prospect.name, right.prospect.name)
      if (sort === 'evidence') return (right._count?.evidence ?? 0) - (left._count?.evidence ?? 0)
      return Date.parse(right.requestedAt) - Date.parse(left.requestedAt)
    })
  }, [goal, query, runs, sort, status])

  const hasFilters = Boolean(query.trim()) || status !== 'all' || goal !== 'all'

  function clearFilters() {
    setQuery('')
    setStatus('all')
    setGoal('all')
  }

  if (!runs.length) {
    return <EmptyState icon={<Search size={20}/>} title="No research runs yet" body="Start with the prospect identifiers you trust and the offer you want to connect to their current situation." action={<Link href="/dashboard/research/new">Create your first run</Link>}/>
  }

  return <>
    <section className="grid gap-3.5" aria-label="Prospect filters and sorting">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter prospects by status">
        {statuses.map((option) => {
          const selected = status === option.value
          return <button
            type="button"
            key={option.value}
            aria-pressed={selected}
            onClick={() => setStatus(option.value)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/20 motion-reduce:transition-none ${selected ? 'border-brand bg-brand text-white shadow-sm' : 'border-lt-200 bg-white text-lt-600 hover:border-lt-300 hover:bg-lt-50 hover:text-lt-900'}`}
          ><strong className={selected ? 'text-sm text-white' : 'text-sm text-lt-900'}>{totals[option.value]}</strong>{option.label}</button>
        })}
      </div>

      <div className="grid grid-cols-[minmax(240px,1fr)_190px_205px] gap-2.5 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
        <label className="relative block max-[760px]:col-span-2 max-[520px]:col-span-1">
          <span className="sr-only">Search prospects</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lt-500"/>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prospect, company, or offer"
            className="h-11 w-full rounded-control border border-lt-200 bg-white pr-10 pl-10 text-[.82rem] text-lt-900 outline-none transition-[border-color,box-shadow] placeholder:text-lt-500 focus:border-brand focus:ring-3 focus:ring-brand/10"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-lt-500 hover:bg-lt-100 hover:text-lt-900"><X size={15}/></button>}
        </label>

        <label className="relative">
          <span className="sr-only">Filter by brief type</span>
          <select value={goal} onChange={(event) => setGoal(event.target.value as GoalFilter)} className="h-11 w-full appearance-none rounded-control border border-lt-200 bg-white px-3.5 pr-9 text-[.82rem] text-lt-800 outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-3 focus:ring-brand/10">
            <option value="all">All brief types</option>
            <option value="meeting">Meeting briefs</option>
            <option value="outreach">Outreach drafts</option>
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[.65rem] text-lt-500">▼</span>
        </label>

        <label className="relative">
          <span className="sr-only">Sort prospects</span>
          <ArrowUpDown size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lt-500"/>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="h-11 w-full appearance-none rounded-control border border-lt-200 bg-white pr-9 pl-10 text-[.82rem] text-lt-800 outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-3 focus:ring-brand/10">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="prospect">Prospect A–Z</option>
            <option value="company">Company A–Z</option>
            <option value="evidence">Most cited signals</option>
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[.65rem] text-lt-500">▼</span>
        </label>
      </div>
    </section>

    <WorkspaceSection title="All prospects" description={hasFilters ? `${visibleRuns.length} of ${runs.length} prospects shown.` : `${runs.length} researched in this workspace.`}>
      {visibleRuns.length ? <WorkspaceList>{visibleRuns.map((run) => <WorkspaceListLink href={run.brief ? `/dashboard/briefs/${run.brief.id}` : `/dashboard/research/${run.id}`} key={run.id}>
        <ItemIcon>{run.brief ? <Sparkles size={18}/> : <Search size={18}/>}</ItemIcon>
        <ItemBody heading="h2" title={<>{run.prospect.name}{run.prospect.companyName ? ` · ${run.prospect.companyName}` : ''}</>} description={<>{run.goal === 'meeting' ? 'Meeting brief' : 'Outreach draft'} · {run.offer.name} · {run._count?.evidence ?? 0} cited signals</>}/>
        <ItemMeta><div className="flex flex-col items-end gap-1.5"><StatusBadge status={run.brief ? 'ready' : run.status}/>{run.brief && <UrgencyBadge label={briefUrgencyLabel(run.brief.sections)}/>}</div><time>{run.brief ? 'Open brief' : formatDate(run.requestedAt, { year: undefined })}</time></ItemMeta>
      </WorkspaceListLink>)}</WorkspaceList> : <EmptyState
        icon={<Search size={20}/>}
        title="No matching prospects"
        body="Try a different status, brief type, or search term."
        action={<Button type="button" variant="ghost" size="xs" onClick={clearFilters}>Clear filters</Button>}
      />}
    </WorkspaceSection>
  </>
}
