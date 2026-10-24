import { ArrowRight, Check, CircleDashed, Search } from 'lucide-react'
import Link from 'next/link'
import { CalendarConnection } from '../../../components/crm/calendar'
import { StatusBadge } from '../../../components/ui/status-badge'
import { WorkspaceHeader, WorkspacePage } from '../../../components/workspace/workspace-page'
import type { CalendarStatus } from '../../../lib/crm'
import type { IntegrationCapabilities } from '../../../lib/research'
import { authenticatedFetch } from '../../../lib/server-auth'

const descriptions: Record<string, string> = {
  intake: 'Save the contact and the context for your research.',
  'source-discovery': 'Find relevant public sources about the prospect.',
  'evidence-normalization': 'Extract claims and keep the sources behind them.',
  'brief-synthesis': 'Turn the evidence into a meeting plan or an outreach message.',
  'notification-delivery': 'Let you know when your brief is ready.',
}

export default async function Page({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const result = (await searchParams).calendar
  const [calendar, capabilities] = await Promise.all([
    authenticatedFetch<CalendarStatus>('/crm/calendar'),
    authenticatedFetch<IntegrationCapabilities>('/integrations'),
  ])

  return <WorkspacePage>
    <WorkspaceHeader eyebrow="Integrations" title="Connect what helps you work." lead="Your CRM works on its own. Add Calendar when you want to schedule meetings directly from a contact."/>
    {calendar && <CalendarConnection status={calendar} result={typeof result === 'string' ? result : undefined}/>}
    <section className="grid gap-4 rounded-2xl border border-lt-200 bg-white p-5">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-lt-100 text-brand"><Search size={20}/></span><div><h2 className="m-0 text-lg text-lt-900">Prospect research</h2><p className="mt-1 mb-0 text-xs text-lt-500">Built into Lead Trace</p></div></div>
      <p className="m-0 max-w-2xl text-sm leading-relaxed text-lt-600">Open a contact and choose Research contact. Add what you sell and choose meeting preparation or outreach. Your brief and its sources stay linked to that person.</p>
      <Link href="/dashboard/contacts" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand">Choose a contact to research<ArrowRight size={15}/></Link>
    </section>
    {capabilities && <details className="rounded-2xl border border-lt-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold text-lt-700">Research service status</summary>
      <p className="my-4 text-xs text-lt-600">Source provider: {capabilities.webDiscovery.provider} · Search depth: {capabilities.webDiscovery.searchDepth} · Up to {capabilities.webDiscovery.maxResults} results per query.</p>
      <div className="grid gap-3">{capabilities.stages.map((stage) => <article key={stage.id} className="flex items-start gap-3 rounded-xl border border-lt-100 p-3"><span className="mt-1 shrink-0 text-brand">{stage.status === 'ready' ? <Check size={17}/> : <CircleDashed size={17}/>}</span><div className="min-w-0 flex-1"><h3 className="m-0 text-sm text-lt-900">{stage.label}</h3><p className="mt-1 mb-0 text-xs leading-relaxed text-lt-600">{descriptions[stage.id]}</p></div><StatusBadge status={stage.status}/></article>)}</div>
    </details>}
  </WorkspacePage>
}
