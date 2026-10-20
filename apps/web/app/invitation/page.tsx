import type { Metadata } from 'next'
import { InvitationAcceptance } from '../../components/invitation-acceptance'
import { Brand } from '../../components/ui/brand'
import { getAccountContext } from '../../lib/server-auth'

export const metadata: Metadata = { title: 'Workspace invitation · Lead Trace' }

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const requestedId = (await searchParams).id
  const invitationId = typeof requestedId === 'string' ? requestedId : ''
  const context = await getAccountContext()

  return <main className="min-h-screen bg-lt-50 bg-[radial-gradient(circle_at_90%_0%,#e8f6ff_0,transparent_28%)] px-6 py-[30px]">
    <header className="mx-auto w-full max-w-[1000px] text-lt-900"><Brand/></header>
    <InvitationAcceptance invitationId={invitationId} user={context?.user ?? null}/>
  </main>
}
