import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, SiteShell } from '../../components/site-shell'

export const metadata: Metadata = {
  title: 'Contact · Lead Trace',
  description: 'Get in touch with the Lead Trace team.',
}

export default function ContactPage() {
  return <SiteShell title="Contact" lead="We’re a small team building Lead Trace. Reach out and we’ll get back as soon as we can.">
    <Section title="Product & support">
      <p>Ready to begin? <Link href="/sign-up">Create your workspace</Link>. For product questions, contact us below.</p>
    </Section>
    <Section title="Email">
      <p>General, privacy, and support: <a href="mailto:hello@leadtrace.online">hello@leadtrace.online</a></p>
    </Section>
    <Section title="Policies">
      <p>Read our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link>.</p>
    </Section>
  </SiteShell>
}
