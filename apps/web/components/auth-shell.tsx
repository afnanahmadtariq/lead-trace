import { FileCheck2, Search, Sparkles, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { Brand } from './ui/brand'

export function AuthShell({ children, mode }: { children: ReactNode; mode: 'sign-in' | 'sign-up' }) {
  return <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[minmax(380px,.9fr)_minmax(500px,1.1fr)]">
    <section className="relative flex min-h-[235px] flex-col overflow-hidden bg-lt-950 px-5 py-[22px] text-white sm:min-h-80 sm:px-9 sm:py-7 lg:h-screen lg:min-h-0 lg:px-[52px] lg:pt-[38px] lg:pb-11">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255_/_6%)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255_/_6%)_1px,transparent_1px)] bg-[size:46px_46px] opacity-50 [mask-image:linear-gradient(to_bottom_right,black,transparent_76%)]"/>
      <div className="relative z-10"><Brand/></div>
      <div className="relative z-10 my-auto pt-8 pb-2.5 sm:pt-12 sm:pb-6 lg:py-[70px]">
        <p className="text-[.74rem] font-[650] tracking-[.13em] text-sky uppercase">Evidence-first sales intelligence</p>
        <h1 className="my-4 max-w-[600px] text-[2.1rem] leading-none font-normal tracking-[-.055em] sm:text-[2.8rem] lg:text-[clamp(2.5rem,5vw,4.6rem)]">{mode === 'sign-up' ? 'Know the person. Understand the moment.' : 'Your deal intelligence is ready when you are.'}</h1>
        <p className="hidden max-w-[520px] text-base leading-relaxed text-lt-300 lg:block">Research prospects, connect their current signals to your offer, and prepare outreach that can be verified.</p>
        <div className="mt-9 hidden grid-cols-4 gap-2 sm:grid">
          <AuthFeature icon={<Target size={18}/>} label="Identify"/><AuthFeature icon={<Search size={18}/>} label="Research"/><AuthFeature icon={<FileCheck2 size={18}/>} label="Verify"/><AuthFeature icon={<Sparkles size={18}/>} label="Act"/>
        </div>
      </div>
      <small className="relative z-10 hidden text-lt-500 lg:block">Lead Trace · Evidence behind every claim</small>
    </section>
    <section className="grid place-items-start bg-white bg-[radial-gradient(circle_at_90%_8%,rgb(73_188_247_/_10%),transparent_24%)] px-5 pt-10 pb-[60px] sm:place-items-center sm:px-[25px] sm:py-[55px] lg:px-[30px] lg:py-12">
      <div className="w-full max-w-[430px]">{children}</div>
    </section>
  </main>
}

export function AuthIntro({ title, children }: { title: string; children: ReactNode }) {
  return <><h2 className="m-0 text-[2rem] font-medium tracking-[-.045em] text-lt-900">{title}</h2><p className="mt-2 mb-7 leading-relaxed text-lt-600">{children}</p></>
}

function AuthFeature({ icon, label }: { icon: ReactNode; label: string }) {
  return <span className="grid gap-2.5 rounded-xl border border-white/15 bg-white/5 px-2.5 py-3 text-[.72rem] font-semibold tracking-wide text-lt-300 uppercase"><span className="text-sky">{icon}</span>{label}</span>
}
