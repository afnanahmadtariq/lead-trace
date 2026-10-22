import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Section, SiteShell } from '../../components/site-shell'

export const metadata: Metadata = {
  title: 'About · Lead Trace',
  description: 'Lead Trace turns live public signals into evidence-backed conversation briefs for agency SDRs and SaaS account executives.',
}

export default function AboutPage() {
  return <SiteShell title="About Lead Trace" lead="Evidence-first sales intelligence for people who sell with context, not guesswork.">
    <Section title="From InsightIQ to Lead Trace">
      <div className="flex flex-wrap items-center justify-center gap-8 rounded-2xl border border-lt-200 bg-white px-6 py-8" aria-label="InsightIQ is now Lead Trace">
        <div className="grid justify-items-center gap-3"><Image src="/legacy/insightiq-logo.svg" alt="Former InsightIQ logo" width={72} height={72}/><span className="text-sm text-lt-600">InsightIQ</span></div>
        <span className="text-2xl text-lt-300" aria-hidden="true">→</span>
        <div className="grid justify-items-center gap-3"><Image src="/lead-trace-logo.svg" alt="Lead Trace logo" width={72} height={72}/><span className="text-sm font-semibold text-brand">Lead Trace</span></div>
      </div>
      <p>We listened to feedback from industry professionals and used it to shape the next stage of our project. InsightIQ is now Lead Trace, with a broader direction built around the needs of sales teams.</p>
      <p>Our research and briefing tools now connect with lead discovery and a built-in CRM. Teams can review source-linked leads, save contacts, track deals and follow-ups, and prepare for the next conversation. We continue to refine the workflow with industry feedback.</p>
    </Section>
    <Section title="What we build">
      <div className="flex items-center gap-6 max-sm:flex-col">
        <p>Lead Trace researches public signals about a prospect, connects them to the offer you sell, and produces a conversation brief you can verify—with a source behind every claim.</p>
        <Image className="shrink-0" src="/lead-trace-illustration.svg" alt="A magnifying glass tracing a fingerprint" width={140} height={140}/>
      </div>
    </Section>
    <Section title="Who it’s for">
      <p>Built first for agency SDR teams and SaaS account executives who need timely context before outreach or meetings—without spending 10–30 minutes researching every prospect.</p>
    </Section>
    <Section title="Where we are">
      <p>Lead Trace is live with the research → evidence → brief loop, and we’re continuing to expand integrations and workflows.</p>
      <p><Link href="/sign-up">Create your workspace</Link> or <Link href="/contact">get in touch</Link>.</p>
    </Section>
  </SiteShell>
}
