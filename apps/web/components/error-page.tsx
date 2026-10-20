import { ArrowLeft, Link2Off, SearchX } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Brand } from './ui/brand'
import { ButtonLink } from './ui/button'

const container = 'mx-auto w-[min(1160px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_36px)]'

function ErrorShell({ icon, eyebrow, title, lead, children }: {
  icon: ReactNode
  eyebrow: string
  title: string
  lead: string
  children?: ReactNode
}) {
  return <main className="min-h-screen bg-lt-50 text-lt-950">
    <nav className={`${container} flex items-center justify-between py-5`} aria-label="Error page navigation">
      <Brand/>
      <Link className="text-sm font-semibold text-brand hover:underline" href="/sign-in">Sign in</Link>
    </nav>

    <section className={`${container} grid justify-items-start gap-6 py-16 pb-24 max-sm:py-12`}>
      <span className="grid size-14 place-items-center rounded-2xl bg-white text-brand shadow-card ring-1 ring-lt-200">{icon}</span>
      <div className="grid max-w-[640px] gap-3">
        <p className="m-0 text-[.69rem] font-bold tracking-[.12em] text-brand uppercase">{eyebrow}</p>
        <h1 className="m-0 text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] font-light tracking-[-.055em] text-lt-900">{title}</h1>
        <p className="m-0 text-base leading-relaxed text-lt-600">{lead}</p>
      </div>
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </section>
  </main>
}

export function NotFoundPage() {
  return <ErrorShell
    icon={<SearchX size={26}/>}
    eyebrow="404"
    title="This page isn't here."
    lead="The link may be mistyped, expired, or the page may have moved. Head back to Lead Trace and continue from your workspace."
  >
    <ButtonLink href="/"><ArrowLeft size={16}/>Back to home</ButtonLink>
    <ButtonLink href="/dashboard" variant="secondary">Open dashboard</ButtonLink>
  </ErrorShell>
}

export function RevokedSharePage() {
  return <ErrorShell
    icon={<Link2Off size={26}/>}
    eyebrow="Link revoked"
    title="This shared brief is no longer available."
    lead="The owner revoked public access to this conversation brief. If you still need the context, ask them to share a new link or send the brief directly."
  >
    <ButtonLink href="/sign-up">Create your own brief</ButtonLink>
    <ButtonLink href="/" variant="secondary"><ArrowLeft size={16}/>Back to home</ButtonLink>
  </ErrorShell>
}
