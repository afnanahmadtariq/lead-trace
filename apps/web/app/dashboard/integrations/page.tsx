import { Check, CircleDashed, Plug, Search, Sparkles } from 'lucide-react'
import { StatusBadge } from '../../../components/ui/status-badge'
import { WorkspaceHeader, WorkspacePage, WorkspaceSection, WorkspaceSplit } from '../../../components/workspace/workspace-page'
import type { IntegrationCapabilities } from '../../../lib/research'
import { authenticatedFetch } from '../../../lib/server-auth'

const descriptions: Record<string, string> = {
  intake: 'Tenant-safe prospect and offer inputs are stored with an immutable run snapshot.',
  'source-discovery': 'Parallel Tavily searches collect and deduplicate public source records.',
  'evidence-normalization': 'The worker extracts bounded claims with confidence and direct source relationships.',
  'brief-synthesis': 'Meeting and outreach recommendations are generated from accepted evidence only.',
  'notification-delivery': 'In-app notifications tell the owner when a conversation brief is ready.',
}

export default async function Page() {
  const capabilities = await authenticatedFetch<IntegrationCapabilities>('/integrations')
  if (!capabilities) return null

  return <WorkspacePage>
    <WorkspaceHeader eyebrow="Data sources" title="Know what powers each brief." lead="Provider status and evidence safeguards for this workspace."/>
    <WorkspaceSplit>
      <section className="rounded-[17px] border border-lt-200 bg-white p-[23px]"><header className="flex items-center justify-between gap-4"><span className="grid size-[42px] place-items-center rounded-xl bg-[linear-gradient(135deg,#dff4ff,#e2ecff)] text-brand"><Search size={20}/></span><StatusBadge status={capabilities.webDiscovery.status}/></header><h2 className="mt-5 mb-[7px] text-[1.08rem] text-lt-900">{capabilities.webDiscovery.provider} web discovery</h2><p className="m-0 text-[.83rem] leading-[1.6] text-lt-600">{capabilities.webDiscovery.status === 'configured' ? 'A dedicated API key is configured for reliable production discovery.' : 'The SDK is active in shared keyless evaluation mode. Add TAVILY_API_KEY to production before sustained usage.'}</p><dl className="mt-5 mb-0 grid grid-cols-2 gap-2.5"><CapabilityStat label="Search depth" value={capabilities.webDiscovery.searchDepth}/><CapabilityStat label="Results per query" value={capabilities.webDiscovery.maxResults}/></dl></section>
      <WorkspaceSection title="Architecture boundary" description="The next services consume the records already stored by the API."><div className="grid min-h-[186px] content-between rounded-[17px] border border-lt-200 bg-white p-[21px]"><span className="grid size-[38px] place-items-center rounded-[11px] bg-lt-100 text-brand"><Plug size={19}/></span><div><h3 className="mt-[22px] mb-[7px] text-[1.03rem] text-lt-900">Worker contract</h3><p className="m-0 text-[.87rem] leading-[1.55] text-lt-600">Research runs, sources, evidence, briefs, and notifications already share tenant-safe compound relationships.</p></div><footer className="mt-[22px] flex items-center justify-between gap-2.5 text-[.77rem] font-[650] text-brand">PostgreSQL is the current handoff <Sparkles size={15}/></footer></div></WorkspaceSection>
    </WorkspaceSplit>
    <WorkspaceSection title="End-to-end safeguards" description="Every production stage is connected and reports its current readiness."><div className="grid gap-[9px]">{capabilities.stages.map((stage, index) => <article className="flex items-center gap-[13px] rounded-[14px] border border-lt-200 bg-white p-[17px]" key={stage.id}><span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-lt-100 text-brand">{stage.status === 'ready' ? <Check size={17}/> : <CircleDashed size={17}/>}</span><div className="flex-1"><h2 className="mt-0 mb-[3px] text-[.9rem] text-lt-900">{String(index + 1).padStart(2, '0')} · {stage.label}</h2><p className="m-0 text-[.75rem] text-lt-500">{descriptions[stage.id]}</p></div><StatusBadge status={stage.status}/></article>)}</div></WorkspaceSection>
  </WorkspacePage>
}

function CapabilityStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-lt-50 p-3"><dt className="text-[.65rem] tracking-wider text-lt-500 uppercase">{label}</dt><dd className="mt-1 mb-0 text-sm text-lt-900">{value}</dd></div>
}
