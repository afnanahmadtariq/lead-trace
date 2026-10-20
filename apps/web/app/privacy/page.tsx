import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, SiteShell } from '../../components/site-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy · Lead Trace',
  description: 'How Lead Trace collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  return <SiteShell title="Privacy Policy" lead="We collect only what we need to run Lead Trace, improve the product, and communicate with you." updated="September 5, 2026">
    <Section title="What we collect">
      <ul>
        <li>Account details you provide (name, email, password or OAuth identity).</li>
        <li>Workspace content you enter (prospects, offers, research inputs, briefs).</li>
        <li>Contact details you provide when you contact us or request product updates.</li>
        <li>Basic technical logs (IP, device/browser, timestamps) for security and reliability.</li>
      </ul>
    </Section>
    <Section title="How we use it">
      <ul>
        <li>Provide and secure your account and workspace.</li>
        <li>Run research, store evidence, and generate Deal Briefs you request.</li>
        <li>Send product updates, account notices, and service messages you requested.</li>
        <li>Detect abuse, debug issues, and improve the service.</li>
      </ul>
    </Section>
    <Section title="Research & public data">
      <p>When you start a research run, Lead Trace may collect publicly available information about the prospect or company you specify. That material is stored in your workspace with source links so you can review it. You are responsible for using research outputs in line with applicable laws and your own policies.</p>
    </Section>
    <Section title="Sharing">
      <p>We do not sell personal data. We may share data with infrastructure providers that help us host, authenticate, email, or process requests—only as needed to operate Lead Trace—and if required by law.</p>
    </Section>
    <Section title="Retention & your choices">
      <p>We keep account and workspace data while your account is active. You can request access, correction, or deletion of personal data by contacting us. You can unsubscribe from marketing emails at any time.</p>
    </Section>
    <Section title="Security">
      <p>We use industry-standard practices (encrypted transport, access controls, session security). No method of transmission or storage is perfectly secure; please use a strong password and protect your credentials.</p>
    </Section>
    <Section title="Contact">
      <p>Privacy questions: <Link href="/contact">Contact us</Link>.</p>
    </Section>
  </SiteShell>
}
