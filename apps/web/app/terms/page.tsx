import type { Metadata } from 'next'
import Link from 'next/link'
import { Section, SiteShell } from '../../components/site-shell'

export const metadata: Metadata = {
  title: 'Terms of Service · Lead Trace',
  description: 'Terms governing use of the Lead Trace service.',
}

export default function TermsPage() {
  return <SiteShell title="Terms of Service" lead="By using Lead Trace you agree to these terms. If you do not agree, do not use the service." updated="September 3, 2026">
    <Section title="The service">
      <p>Lead Trace provides AI-assisted prospect research and Deal Briefs based on inputs you provide and publicly available sources. Features may change as we iterate in private beta.</p>
    </Section>
    <Section title="Accounts">
      <p>You must provide accurate account information and keep credentials secure. You are responsible for activity under your account. We may suspend accounts that abuse the service or violate these terms.</p>
    </Section>
    <Section title="Acceptable use">
      <ul>
        <li>Do not use Lead Trace for unlawful surveillance, harassment, discrimination, or fraud.</li>
        <li>Do not attempt to bypass security, scrape the product, or disrupt the service.</li>
        <li>Do not upload content you lack rights to use, or content that is illegal or harmful.</li>
        <li>Use research outputs only in ways that comply with applicable law and third-party terms.</li>
      </ul>
    </Section>
    <Section title="Your content">
      <p>You retain ownership of content you submit. You grant Lead Trace a limited license to host, process, and display that content as needed to provide the service. Generated briefs and research artifacts in your workspace are for your use subject to these terms.</p>
    </Section>
    <Section title="AI & accuracy">
      <p>Outputs may be incomplete, outdated, or incorrect. Lead Trace is a research aid, not legal, financial, or professional advice. Always verify citations and exercise your own judgment before acting on a Deal Brief.</p>
    </Section>
    <Section title="Availability">
      <p>We aim for reliable uptime but do not guarantee uninterrupted service. During beta, features may be added, changed, or removed without notice.</p>
    </Section>
    <Section title="Disclaimer & liability">
      <p>The service is provided “as is” without warranties of any kind to the fullest extent permitted by law. Lead Trace is not liable for indirect, incidental, or consequential damages arising from your use of the service. Our aggregate liability is limited to the fees you paid us (if any) in the three months before the claim.</p>
    </Section>
    <Section title="Changes">
      <p>We may update these terms. Continued use after changes means you accept the updated terms. Material changes will be noted by updating the date above.</p>
    </Section>
    <Section title="Contact">
      <p>Questions about these terms: <Link href="/contact">Contact us</Link>. See also our <Link href="/privacy">Privacy Policy</Link>.</p>
    </Section>
  </SiteShell>
}
