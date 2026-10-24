import { ArrowUpRight, FileCheck2, Search } from 'lucide-react'
import Link from 'next/link'
import { ButtonLink } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { MetricCard, MetricGrid } from '../../../components/workspace/metric-card'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection } from '../../../components/workspace/workspace-page'
import { publicSourceUrl } from '../../../lib/brief'
import { formatConfidence, formatDate } from '../../../lib/format'
import type { EvidenceLibraryResponse } from '../../../lib/research'
import { requireFetch } from '../../../lib/server-auth'

export default async function Page() {
  const library = await requireFetch<EvidenceLibraryResponse>('/evidence')
  const citedSources = library.sources.filter((source) => source._count.evidence > 0).length

  return <WorkspacePage>
    <WorkspaceHeader eyebrow="Evidence library" title="Trace every signal." lead="Public sources stay separate from normalized claims, so useful context never becomes a “fact” without provenance." action={<ButtonLink href="/dashboard/research" variant="secondary"><Search size={17}/>Research queue</ButtonLink>}/>
    <MetricGrid>
      <MetricCard icon={<Search size={18}/>} value={library.sources.length} label="Collected sources"/>
      <MetricCard icon={<FileCheck2 size={18}/>} value={library.evidence.length} label="Verified claims"/>
      <MetricCard icon={<ArrowUpRight size={18}/>} value={citedSources} label="Cited sources"/>
      <MetricCard icon={<FileCheck2 size={18}/>} value={library.sources.length - citedSources} label="Awaiting review"/>
    </MetricGrid>

    <WorkspaceSection title="Public source layer" description="Discovery output awaiting or supporting evidence extraction.">
      {library.sources.length ? <div className="grid grid-cols-3 gap-[11px] max-[900px]:grid-cols-2 max-[680px]:grid-cols-1">{library.sources.map((source) => <article className="flex min-w-0 flex-col rounded-[15px] border border-lt-200 bg-white p-[19px]" key={source.id}>
        <header className="flex items-center justify-between gap-3 text-[.68rem] font-[650] tracking-[.06em] text-brand uppercase"><span className="truncate">{source.publisher || 'Public web'}</span>{publicSourceUrl(source.url) && <a className="grid size-[29px] shrink-0 place-items-center rounded-lg bg-lt-100" href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`}><ArrowUpRight size={15}/></a>}</header>
        <h2 className="mt-4 mb-2 text-[.92rem] leading-[1.38] text-lt-900">{source.title}</h2>{source.excerpt && <p className="mb-5 line-clamp-4 text-[.78rem] leading-[1.55] text-lt-600">{source.excerpt}</p>}
        <footer className="mt-auto grid gap-2 border-t border-lt-100 pt-[13px] text-[.68rem] text-lt-500"><div className="flex items-center justify-between gap-2.5"><span>{source._count.evidence} claims</span><time>{formatDate(source.retrievedAt, { year: undefined })}</time></div><Link className="font-[650] text-brand" href={`/dashboard/research/${source.researchRun.id}`}>{source.researchRun.prospect.name} · {source.researchRun.offer.name}</Link></footer>
      </article>)}</div> : <EmptyState icon={<Search size={20}/>} title="No sources collected yet" body="Open a queued research run and launch public-source discovery. Results will appear here across the workspace." action={<Link href="/dashboard/research">Open research queue</Link>}/>}
    </WorkspaceSection>

    <WorkspaceSection title="Normalized evidence" description="Claims accepted by the future evidence worker with a source and confidence score.">
      {library.evidence.length ? <div className="grid gap-[9px]">{library.evidence.map((item) => <article className="rounded-[14px] border border-lt-200 bg-white p-[18px]" key={item.id}><header className="flex items-center justify-between gap-3.5"><span className="text-[.68rem] font-[650] tracking-[.06em] text-brand uppercase">{item.signalType}</span><strong className="text-[.7rem] text-success">{formatConfidence(item.confidence)}</strong></header><p className="my-[13px] text-[.88rem] leading-[1.6] text-lt-700">{item.claim}</p><footer className="flex items-center justify-between gap-3.5 text-[.7rem] text-lt-500">{publicSourceUrl(item.source.url) ? <a className="inline-flex items-center gap-[5px] font-[650] text-brand" href={item.source.url} target="_blank" rel="noreferrer">{item.source.title}<ArrowUpRight size={14}/></a> : <span className="font-[650] text-lt-700">{item.source.title}</span>}<Link href={`/dashboard/research/${item.researchRun.id}`}>{item.researchRun.prospect.name}</Link></footer></article>)}</div> : <EmptyState icon={<FileCheck2 size={20}/>} title="Evidence normalization is the next build stage" body="The cross-run page and tenant-safe API are ready for the worker that converts raw sources into bounded, citable claims."/>}
    </WorkspaceSection>
  </WorkspacePage>
}
