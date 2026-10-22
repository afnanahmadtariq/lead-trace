export const stages = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export const lifecycles = ['lead', 'qualified', 'customer', 'inactive'] as const
export type Person = { id: string; name: string }
export type Contact = {
  id: string; name: string; email: string | null; companyName: string | null; companyDomain: string | null
  jobTitle: string | null; phone: string | null; lifecycle: string; ownerId: string | null; owner: Person | null
  linkedinUrl?: string | null; xHandle?: string | null
  _count: { researchRuns: number; deals: number }
}
export type ContactPage = { items: Contact[]; total: number; page: number; pageSize: number }
export type Deal = { id: string; prospectId: string; title: string; stage: string; value: string; currency: string; ownerId: string | null; owner: Person | null; expectedCloseAt: string | null; prospect: { id: string; name: string; companyName: string | null } }
export type Task = { id: string; prospectId: string; title: string; dueAt: string; completedAt: string | null; owner: Person | null; prospect?: Person }
export type Meeting = { id: string; prospectId: string; organizerId: string; title: string; startsAt: string; endsAt: string; inviteContact: boolean; status: string; htmlLink: string | null }
export type ContactDetail = Contact & {
  leadCandidates?: { id: string; quote: string; source: { title: string; url: string }; search: { id: string; title: string } }[]
  researchRuns: { id: string; goal: string; status: string; requestedAt: string; brief: { id: string; title: string } | null }[]
  deals: Deal[]; notes: { id: string; body: string; createdAt: string; author: Person | null }[]; tasks: Task[]; meetings: Meeting[]
}
export type CalendarStatus = { configured: boolean; connected: boolean; updatedAt: string | null }
export const cardClass = 'rounded-2xl border border-lt-200 bg-white p-5'
export const controlClass = 'min-h-11 w-full rounded-xl border border-lt-300 bg-white px-3 py-2 text-sm text-lt-900 focus:outline-brand'
export function money(value: string | number, currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)) }
export const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
