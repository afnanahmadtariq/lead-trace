import { notFound } from 'next/navigation'
import { ContactDetail } from '../../../../components/crm/contact-detail'
import type { CalendarStatus, ContactDetail as Detail, Person } from '../../../../lib/crm'
import { authenticatedFetch, requireWorkspace } from '../../../../lib/server-auth'
import { headers } from 'next/headers'
import { API_URL } from '../../../../lib/api-client'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await requireWorkspace()
  const response = await fetch(`${API_URL}/crm/contacts/${encodeURIComponent(id)}`, { cache: 'no-store', headers: { cookie: (await headers()).get('cookie') || '' } })
  if (response.status === 404) notFound()
  if (!response.ok) throw new Error('Could not load contact')
  const contact = await response.json() as Detail
  const [members, calendar] = await Promise.all([authenticatedFetch<Person[]>('/crm/members'), authenticatedFetch<CalendarStatus>('/crm/calendar')])
  return <ContactDetail contact={contact} members={members ?? []} calendar={calendar ?? { configured: false, connected: false, updatedAt: null }} userId={context.user.id}/>
}
