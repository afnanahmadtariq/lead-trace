import type { Metadata } from 'next'
import { OnboardingForm } from '../../components/onboarding-form'
import { Brand } from '../../components/ui/brand'
import { requireAccountContext } from '../../lib/server-auth'
export const metadata: Metadata = { title: 'Create workspace · Lead Trace' }
export default async function Page() {
  const context = await requireAccountContext()
  return <main className="min-h-screen bg-lt-50 bg-[radial-gradient(circle_at_90%_0%,#e8f6ff_0,transparent_28%)] px-6 pt-[30px] pb-[70px]">
    <header className="mx-auto flex w-full max-w-[1000px] items-center justify-between text-lt-900"><Brand/><p className="text-sm text-lt-600 max-[560px]:hidden">Signed in as {context.user.email}</p></header>
    <section className="mx-auto mt-[100px] w-full max-w-[720px] max-[560px]:mt-[70px]">
      <p className="mt-0 mb-2.5 text-xs font-semibold tracking-[.12em] text-brand-bright uppercase">Workspace setup</p>
      <h1 className="m-0 text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-normal tracking-[-.055em] text-lt-900">Where your deal intelligence lives.</h1>
      <p className="mt-5 mb-9 max-w-[600px] text-base leading-relaxed text-lt-600">Create a private workspace for your prospects, offers, evidence, and research briefs.</p>
      <OnboardingForm context={context}/>
    </section>
  </main>
}
