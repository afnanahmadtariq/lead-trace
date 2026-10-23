import { ContactDetail } from '../../../../components/crm/contact-detail'
import type { CalendarStatus, ContactDetail as Detail, Person } from '../../../../lib/crm'
import { authenticatedFetch, requireFetch, requireWorkspace } from '../../../../lib/server-auth'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await requireWorkspace()
  const contact = await requireFetch<Detail>(`/crm/contacts/${encodeURIComponent(id)}`)
  const [members, calendar] = await Promise.all([authenticatedFetch<Person[]>('/crm/members'), authenticatedFetch<CalendarStatus>('/crm/calendar')])
  return <ContactDetail contact={contact} members={members ?? []} calendar={calendar ?? { configured: false, connected: false, updatedAt: null }} userId={context.user.id}/>
}
