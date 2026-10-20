import Link from 'next/link'
import type { ReactNode } from 'react'
import { Brand } from './ui/brand'

const container = 'mx-auto w-[min(1160px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_36px)]'
const prose = 'mx-auto w-[min(720px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_36px)]'

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
]

export function SiteShell({ title, lead, children, updated }: {
  title: string
  lead?: string
  children: ReactNode
  updated?: string
}) {
  return <main className="min-h-screen bg-lt-50 text-lt-950">
    <nav className={`${container} flex items-center justify-between py-5`} aria-label="Main navigation">
      <Brand/>
      <div className="flex items-center gap-5 text-sm font-medium text-lt-600 max-sm:gap-3">
        {navLinks.map((link) => <Link className="transition-colors hover:text-brand max-sm:hidden" href={link.href} key={link.href}>{link.label}</Link>)}
        <Link className="transition-colors hover:text-brand" href="/sign-in">Sign in</Link>
      </div>
    </nav>

    <article className={`${prose} py-16 max-sm:py-12`}>
      {updated && <p className="m-0 mb-3 text-[.68rem] font-semibold tracking-[.08em] text-lt-500 uppercase">Updated {updated}</p>}
      <h1 className="m-0 text-[clamp(2.2rem,4vw,3.2rem)] leading-[1.05] font-normal tracking-[-.05em] text-lt-900">{title}</h1>
      {lead && <p className="mt-4 mb-0 max-w-[560px] text-base leading-relaxed text-lt-600">{lead}</p>}
      <div className="mt-10 grid gap-8 text-[.95rem] leading-relaxed text-lt-700 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-.02em] [&_h2]:text-lt-900 [&_p]:m-0 [&_ul]:m-0 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-brand">{children}</div>
    </article>

    <footer className={`${container} flex flex-wrap items-center justify-between gap-4 border-t border-lt-200 py-8 text-xs text-lt-500`}>
      <Brand compact/>
      <div className="flex flex-wrap gap-4">
        {navLinks.map((link) => <Link className="transition-colors hover:text-brand" href={link.href} key={link.href}>{link.label}</Link>)}
      </div>
      <span>© 2026 Lead Trace</span>
    </footer>
  </main>
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="grid gap-3"><h2>{title}</h2>{children}</section>
}
