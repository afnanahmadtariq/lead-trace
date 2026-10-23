import { ArrowRight, Check, Copy, FileText, Globe2, Search, ShieldCheck, Sparkles, Target, UserRound } from 'lucide-react'
import Link from 'next/link'
import { DealBriefPreview } from '../components/landing/deal-brief-preview'
import { EvidencePanel } from '../components/landing/evidence-panel'
import { Eyebrow } from '../components/landing/eyebrow'
import { FeatureCard, type LandingFeature } from '../components/landing/feature-card'
import { LandingBrand } from '../components/landing/landing-brand'
import { RevealObserver } from '../components/landing/reveal-observer'
import { StepCard } from '../components/landing/step-card'
import { ButtonLink } from '../components/ui/button'

const container = 'mx-auto w-[min(1160px,calc(100%_-_48px))] max-sm:w-[calc(100%_-_36px)]'
const sectionTitle = 'm-0 text-[clamp(2.5rem,4.5vw,4rem)] leading-[1.04] font-normal tracking-[-.055em] text-lt-900'

const features: LandingFeature[] = [
  { number: '01', icon: Globe2, title: 'Multi-source research', body: 'Resolve a prospect and research the public web in parallel.' },
  { number: '02', icon: Target, title: 'A conversation angle with proof', body: 'Connect a source claim to a possible offer fit and a question that tests it.' },
  { number: '03', icon: FileText, title: 'Conversation-ready output', body: 'Get an opener, talk track, questions, objections, and next step.' },
  { number: '04', icon: ShieldCheck, title: 'Sources you can inspect', body: 'Trace key signals to stored claims, and keep research gaps in view.' },
]

const audiences = ['Agency SDR teams', 'SaaS account executives']

export default function Home() {
  return <main className="min-h-screen overflow-clip bg-lt-50 text-lt-950">
    <RevealObserver/>

    <nav className={`${container} relative z-20 flex items-center justify-between py-5`} aria-label="Main navigation">
      <a href="#top" aria-label="Lead Trace home"><LandingBrand/></a>
      <div className="flex items-center gap-7 text-sm font-medium text-lt-600 max-sm:gap-0">
        <a className="transition-colors hover:text-brand max-sm:hidden" href="#how-it-works">How it works</a>
        <a className="transition-colors hover:text-brand max-sm:hidden" href="#features">Features</a>
        <Link className="transition-colors hover:text-brand max-sm:hidden" href="/sign-in">Sign in</Link>
        <ButtonLink href="/sign-up" variant="secondary" size="xs" className="bg-white/80 text-brand! shadow-card">Create account</ButtonLink>
      </div>
    </nav>

    <section className={`${container} relative grid min-h-0 grid-cols-1 items-center gap-16 pt-12 pb-20 lg:min-h-[650px] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)] lg:gap-[clamp(48px,6vw,84px)] lg:py-[68px] lg:pb-24`} id="top">
      <div className="relative z-10 animate-[riseIn_560ms_var(--ease-fluid)_both] lg:max-w-[760px] motion-reduce:animate-none">
        <Eyebrow>Evidence-first sales intelligence</Eyebrow>
        <h1 className="m-0 max-w-[700px] text-[clamp(3.5rem,6vw,5.35rem)] leading-[.98] font-normal tracking-[-.06em] text-lt-900 max-sm:text-[clamp(3rem,14.5vw,4.35rem)]">Know why now.<br/><em className="text-brand-bright not-italic">Know what to say.</em></h1>
        <p className="mt-7 mb-8 max-w-[610px] text-[1.08rem] leading-relaxed text-lt-600 max-sm:text-base">Connect what changed at a company to what you sell. Get a source-linked conversation angle, a question to test it, and a brief you can use.</p>
        <div className="flex items-center gap-5 max-sm:items-start max-sm:flex-col max-sm:gap-3">
          <ButtonLink href="/sign-up" size="md" className="min-w-[194px] justify-between"><span>Start researching</span><ArrowRight size={18}/></ButtonLink>
          <span className="text-xs font-medium text-lt-500">Available now · Create your workspace</span>
        </div>
        <div className="mt-9 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[.65rem] font-semibold tracking-wider text-lt-500 uppercase">Built for</span>
          {audiences.map((audience) => <b className="rounded-full border border-lt-200 bg-white/80 px-2.5 py-1.5 text-[.65rem] font-medium text-lt-600" key={audience}>{audience}</b>)}
        </div>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[520px]"><DealBriefPreview/></div>
      <div className="pointer-events-none absolute -top-52 -right-80 size-[760px] rounded-full bg-[radial-gradient(circle,rgb(89_188_248_/_18%),transparent_68%)]"/>
    </section>

    <section className="grid grid-cols-1 items-center gap-7 bg-lt-900 px-[max(24px,calc((100vw_-_1160px)/2))] py-12 text-white lg:grid-cols-[.75fr_1.25fr] lg:gap-20 lg:py-14" data-reveal>
      <div className="flex items-center gap-4 max-sm:items-start max-sm:flex-col max-sm:gap-0"><strong className="text-[clamp(2.5rem,5vw,4.2rem)] font-normal tracking-[-.07em] text-sky">Why this?</strong><p className="m-0 max-w-[270px] leading-relaxed text-lt-300">A useful conversation starts with a reason that holds up.</p></div>
      <p className="m-0 text-lg leading-relaxed text-lt-200">Lead Trace connects <em className="text-sky not-italic">a source claim</em>, <em className="text-sky not-italic">a possible fit</em>, and <em className="text-sky not-italic">a question to ask</em>. You decide whether the opportunity is real.</p>
    </section>

    <section className={`${container} py-28 max-sm:py-20`} id="how-it-works">
      <div className="mb-12 max-w-[720px] max-sm:mb-9" data-reveal><Eyebrow>From identity to conversation</Eyebrow><h2 className={sectionTitle}>Give research a purpose.<br/>Walk in prepared.</h2></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StepCard number="01" icon={<UserRound size={21}/>} title="Add your prospect" body="Share an identity and the offer you want to position."/>
        <StepCard number="02" icon={<Search size={21}/>} title="Lead Trace investigates" body="Research agents gather public sources and select claims relevant to your offer." delay="delay-one"/>
        <StepCard number="03" icon={<Sparkles size={21}/>} title="Use your conversation brief" body="Open with relevance, ask better questions, and keep every source close." delay="delay-two"/>
      </div>
    </section>

    <section className="grid grid-cols-1 items-center gap-12 bg-lt-100 px-[max(24px,calc((100vw_-_1160px)/2))] py-20 lg:grid-cols-[.9fr_1.1fr] lg:gap-20 lg:py-28" id="evidence">
      <div data-reveal>
        <Eyebrow>Trust is a product feature</Eyebrow><h2 className={sectionTitle}>See the fact.<br/>Test the angle.</h2>
        <p className="my-6 max-w-[520px] text-base leading-relaxed text-lt-600">A conversation angle keeps its source claim, possible relevance, and next question together. Review the evidence before acting.</p>
        <ul className="m-0 grid list-none gap-3 p-0 text-sm text-lt-700">
          {['Source links for the brief’s key signals', 'Sales hypotheses clearly separated from claims', 'Visible gaps and dates to check before use'].map((item) => <li className="flex items-center gap-2.5" key={item}><span className="grid size-[22px] place-items-center rounded-full bg-[#dff5ea] text-success"><Check size={13}/></span>{item}</li>)}
        </ul>
      </div>
      <EvidencePanel/>
    </section>

    <section className={`${container} py-28 max-sm:py-20`} id="features">
      <div className="mb-12 flex flex-col items-start gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-14" data-reveal>
        <div><Eyebrow>Built for the next conversation</Eyebrow><h2 className={sectionTitle}>One workspace.<br/>Your next move.</h2></div>
        <p className="m-0 max-w-[390px] text-base leading-relaxed text-lt-600">Choose outreach or meeting prep. Lead Trace shapes the brief around the job in front of you.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{features.map((feature, index) => <FeatureCard feature={feature} delay={index % 2 ? 'delay-one' : ''} key={feature.number}/>)}</div>
    </section>

    <section className={`${container} mb-28 overflow-hidden rounded-[22px] border border-lt-200 bg-white shadow-card max-sm:mb-20`} data-reveal>
      <div className="flex gap-1 overflow-x-auto border-b border-lt-200 bg-lt-100 p-2.5 text-xs font-medium text-lt-500"><span className="rounded-lg bg-white px-3.5 py-2.5 text-brand shadow-card">Outreach draft</span><span className="whitespace-nowrap px-3.5 py-2.5">Meeting brief</span></div>
      <div className="grid grid-cols-1 items-center gap-9 px-5 py-8 lg:grid-cols-[1fr_.85fr] lg:gap-16 lg:p-12">
        <div><Eyebrow>Useful by design</Eyebrow><h2 className={sectionTitle}>The right output for<br/>what you do next.</h2><p className="mt-5 mb-0 max-w-[490px] text-base leading-relaxed text-lt-600">Choose the job. Get the opener, questions, objection responses, and next action that fit it.</p></div>
        <div className="rounded-panel border border-lt-200 bg-lt-50 p-6"><span className="text-[.65rem] font-semibold tracking-wider text-brand-bright uppercase">Personalized opener</span><p className="my-5 text-base leading-relaxed text-lt-700">“Alex, I noticed Northstar is hiring across two new regions. Is ramping new hires a priority for your team right now?”</p><div className="flex items-center justify-between gap-4 border-t border-lt-200 pt-4 text-xs text-lt-500 max-sm:items-start max-sm:flex-col"><b>Illustrative sample</b><span className="inline-flex items-center gap-1.5 font-semibold text-brand"><Copy size={14}/> Adapt to your voice</span></div></div>
      </div>
    </section>

    <section className="grid grid-cols-1 items-center gap-12 bg-lt-900 px-[max(24px,calc((100vw_-_1160px)/2))] py-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:py-24" id="get-started">
      <div data-reveal><Eyebrow inverse>Start now</Eyebrow><h2 className={`${sectionTitle} text-white`}>Turn signals into<br/>better conversations.</h2><p className="mt-6 mb-0 max-w-[520px] text-base leading-relaxed text-lt-300">Create your workspace, add a prospect and your offer, and get an evidence-backed brief for the conversation ahead.</p></div>
      <div className="delay-one flex flex-col items-start gap-4 rounded-panel border border-white/15 bg-white/5 p-6 backdrop-blur-xl" data-reveal><ButtonLink href="/sign-up" size="md" className="w-full justify-between"><span>Create your workspace</span><ArrowRight size={18}/></ButtonLink><p className="m-0 text-sm text-lt-300">Already have an account? <Link className="font-semibold text-sky hover:underline" href="/sign-in">Sign in</Link></p></div>
    </section>

    <footer className={`${container} flex flex-wrap items-center justify-between gap-4 py-8 text-xs text-lt-500 max-sm:items-start max-sm:flex-col`}>
      <LandingBrand compact/>
      <div className="flex flex-wrap gap-4">
        <Link className="transition-colors hover:text-brand" href="/about">About</Link>
        <Link className="transition-colors hover:text-brand" href="/privacy">Privacy</Link>
        <Link className="transition-colors hover:text-brand" href="/terms">Terms</Link>
        <Link className="transition-colors hover:text-brand" href="/contact">Contact</Link>
      </div>
      <span>© 2026 Lead Trace</span>
    </footer>
  </main>
}
