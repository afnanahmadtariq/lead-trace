import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, SiteShell } from '../../components/site-shell'

export const metadata: Metadata = {
  title: 'About · Lead Trace',
  description: 'Lead Trace turns live public signals into evidence-backed conversation briefs for agency SDRs and SaaS account executives.',
}

export default function AboutPage() {
  return <SiteShell title="About Lead Trace" lead="Evidence-first sales intelligence for people who sell with context, not guesswork.">
    <Section title="What we build">
      <p>Lead Trace researches public signals about a prospect, connects them to the offer you sell, and produces a conversation brief you can verify—with a source behind every claim.</p>
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
