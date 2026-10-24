import { ArrowRight, FileText, Globe2, ShieldCheck, Target } from 'lucide-react'
import Link from 'next/link'
import { DealBriefPreview } from '../components/landing/deal-brief-preview'
import { EvidencePanel } from '../components/landing/evidence-panel'
import { Eyebrow } from '../components/landing/eyebrow'
import { FeatureCard } from '../components/landing/feature-card'
import { LandingBrand } from '../components/landing/landing-brand'
import { RevealObserver } from '../components/landing/reveal-observer'
import { StepCard } from '../components/landing/step-card'
import { ButtonLink } from '../components/ui/button'

const container = 'mx-auto w-[min(1160px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_36px)]'
const sectionTitle = 'm-0 max-w-[720px] text-[clamp(2rem,3.8vw,3.1rem)] leading-[1.08] font-medium tracking-[-.04em] text-lt-900'
const navLink = 'rounded-sm transition-colors hover:text-brand focus-visible:text-brand'

export default function Home() {
  return <main className="min-h-dvh overflow-clip bg-lt-50 text-lt-950">
    <RevealObserver/>

    <nav className={`${container} relative z-20 flex items-center justify-between py-5`} aria-label="Main navigation">
      <a href="#top" aria-label="Lead Trace home"><LandingBrand/></a>
      <div className="flex items-center gap-7 text-sm font-medium text-lt-600 max-sm:gap-4">
        <a className={`${navLink} max-md:hidden`} href="#how-it-works">How it works</a>
        <a className={`${navLink} max-md:hidden`} href="#evidence">Evidence</a>
        <a className={`${navLink} max-md:hidden`} href="#features">Features</a>
        <Link className={navLink} href="/sign-in">Sign in</Link>
        <ButtonLink href="/sign-up" size="xs">Create workspace</ButtonLink>
      </div>
    </nav>

    <section className={`${container} grid grid-cols-1 items-center gap-12 pt-10 pb-20 lg:min-h-[min(640px,calc(100dvh_-_80px))] lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:gap-[clamp(40px,5vw,72px)] lg:pt-12 lg:pb-16`} id="top">
      <div className="animate-[riseIn_560ms_var(--ease-fluid)_both] motion-reduce:animate-none">
        <Eyebrow>Evidence-first sales intelligence</Eyebrow>
        <h1 className="m-0 max-w-[700px] text-[clamp(3rem,4.9vw,4.4rem)] leading-none font-medium tracking-[-.05em] text-lt-900 max-sm:text-[clamp(2.75rem,13vw,3.75rem)]">Know why now.<br/><span className="text-brand">Know what to say.</span></h1>
        <p className="mt-6 mb-8 max-w-[460px] text-lg leading-relaxed text-lt-600 max-sm:text-base">Connect what changed at a company to what you sell, with a source behind every claim.</p>
        <ButtonLink href="/sign-up" size="md" className="min-w-[200px] justify-between"><span>Create workspace</span><ArrowRight size={18} aria-hidden="true"/></ButtonLink>
      </div>
      <div className="w-full max-w-[500px] lg:justify-self-end"><DealBriefPreview/></div>
    </section>

    <section className={`${container} border-t border-lt-200 py-24 max-sm:py-16`} id="how-it-works">
      <div className="mb-14 max-sm:mb-10" data-reveal><h2 className={sectionTitle}>Give research a purpose.<br/>Walk in prepared.</h2></div>
      <ol className="m-0 grid list-none grid-cols-1 p-0 lg:grid-cols-3">
        <StepCard title="Add the prospect" body="Share an identity and the offer you want to position."/>
        <StepCard title="Research the public web" body="Agents gather public sources and select the claims relevant to your offer." delay="delay-one"/>
        <StepCard title="Open with the brief" body="Start with relevance, ask better questions, and keep every source close." delay="delay-two"/>
      </ol>
    </section>

    <section className="border-y border-lt-200 bg-white py-24 max-sm:py-16" id="evidence">
      <div className={`${container} grid grid-cols-1 items-start gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20`}>
        <div data-reveal>
          <Eyebrow>Every claim traces to a source</Eyebrow>
          <h2 className={sectionTitle}>See the fact.<br/>Test the angle.</h2>
          <p className="mt-6 mb-0 max-w-[480px] text-base leading-relaxed text-lt-600">A useful conversation starts with a reason that holds up. Lead Trace keeps the source claim, the possible fit, and the question to ask together. You decide whether the opportunity is real.</p>
          <ul className="mt-8 mb-0 grid max-w-[480px] list-none divide-y divide-lt-200 border-y border-lt-200 p-0 text-sm text-lt-700">
            {['Source links for the brief’s key signals', 'Sales hypotheses kept separate from claims', 'Visible gaps and dates to check before use'].map((item) => <li className="py-3" key={item}>{item}</li>)}
          </ul>
        </div>
        <EvidencePanel/>
      </div>
    </section>

    <section className={`${container} py-24 max-sm:py-16`} id="features">
      <div className="mb-12 max-sm:mb-9" data-reveal>
        <h2 className={sectionTitle}>One workspace.<br/>Your next move.</h2>
        <p className="mt-5 mb-0 max-w-[520px] text-base leading-relaxed text-lt-600">Choose outreach or meeting prep. Lead Trace shapes the brief around the job in front of you.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FeatureCard featured className="md:col-span-2 md:row-span-2" feature={{ icon: FileText, title: 'Conversation-ready output', body: 'Get an opener, talk track, questions, objections, and a next step that fit the job.' }}>
          <figure className="mx-0 mt-8 mb-0 border-l-2 border-brand pl-5">
            <blockquote className="m-0 text-base leading-relaxed text-lt-800">“Alex, I noticed Northstar is hiring across two new regions. Is ramping new hires a priority for your team right now?”</blockquote>
            <figcaption className="mt-3 text-xs text-lt-600">Conversation opener · sample data</figcaption>
          </figure>
        </FeatureCard>
        <FeatureCard delay="delay-one" feature={{ icon: Globe2, title: 'Multi-source research', body: 'Resolve a prospect and research the public web in parallel.' }}/>
        <FeatureCard delay="delay-two" feature={{ icon: Target, title: 'An angle with proof', body: 'Connect a source claim to a possible offer fit and a question that tests it.' }}/>
        <FeatureCard className="md:col-span-3" feature={{ icon: ShieldCheck, title: 'Sources you can inspect', body: 'Trace key signals to stored claims, and keep research gaps in view.' }}/>
      </div>
    </section>

    <section className={`${container} mb-24 rounded-2xl border border-lt-200 bg-lt-100 px-8 py-14 max-sm:mb-16 max-sm:px-5 max-sm:py-10 lg:px-14`} id="get-started" data-reveal>
      <h2 className={sectionTitle}>Turn signals into<br/>better conversations.</h2>
      <p className="mt-5 mb-8 max-w-[500px] text-base leading-relaxed text-lt-700">Add a prospect and your offer. Get a brief where every claim traces to a source.</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <ButtonLink href="/sign-up" size="md" className="min-w-[200px] justify-between"><span>Create workspace</span><ArrowRight size={18} aria-hidden="true"/></ButtonLink>
        <p className="m-0 text-sm text-lt-700">Already have an account? <Link className="font-semibold text-brand underline-offset-2 hover:underline focus-visible:underline" href="/sign-in">Sign in</Link></p>
      </div>
    </section>

    <footer className={`${container} flex flex-wrap items-center justify-between gap-4 border-t border-lt-200 py-8 text-xs text-lt-600 max-sm:items-start max-sm:flex-col`}>
      <LandingBrand compact/>
      <div className="flex flex-wrap gap-4">
        <Link className={navLink} href="/about">About</Link>
        <Link className={navLink} href="/privacy">Privacy</Link>
        <Link className={navLink} href="/terms">Terms</Link>
        <Link className={navLink} href="/contact">Contact</Link>
      </div>
      <span>© 2026 Lead Trace</span>
    </footer>
  </main>
}
