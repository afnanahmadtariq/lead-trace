import { redirect } from 'next/navigation'
import { TwoFactorChallenge } from '../../components/two-factor-challenge'
import { Brand } from '../../components/ui/brand'
import { requireAccountContext } from '../../lib/server-auth'
export default async function Page() {
  const context = await requireAccountContext()
  if (!context.requirements.requiresTwoFactorChallenge) redirect(context.destination)
  return <main className="grid min-h-screen place-items-center bg-lt-50 bg-[radial-gradient(circle_at_85%_6%,rgb(73_188_247_/_14%),transparent_26%)] px-5 py-[30px]">
    <section className="w-full max-w-[520px] rounded-[22px] border border-lt-200 bg-white p-[30px] shadow-panel">
      <Brand/><h1 className="mt-8 mb-2 text-[2.5rem] font-normal tracking-[-.05em] text-lt-900">Verify it is you</h1><p className="mt-0 mb-6 leading-relaxed text-lt-600">Complete this security check before opening your workspace.</p><TwoFactorChallenge context={context}/>
    </section>
  </main>
}
