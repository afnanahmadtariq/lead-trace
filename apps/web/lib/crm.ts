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
export const controlClass = 'min-h-[47px] w-full rounded-control border border-lt-300 bg-white px-3.5 py-2 text-[.95rem] text-lt-950 transition-[border-color,box-shadow] duration-200 placeholder:text-[#97aac3] focus:border-brand-bright focus:outline-0 focus:ring-3 focus:ring-brand-bright/10 motion-reduce:transition-none'
export const compactControlClass = 'min-h-10 rounded-control border border-lt-300 bg-white px-3 text-sm text-lt-900 transition-[border-color,box-shadow] duration-200 placeholder:text-[#97aac3] focus:border-brand-bright focus:outline-0 focus:ring-3 focus:ring-brand-bright/10 motion-reduce:transition-none'
export const labelClass = 'grid gap-[7px] text-sm font-semibold text-lt-700'
export const emptyClass = 'rounded-xl border border-dashed border-lt-300 bg-lt-50/60 p-5 text-sm leading-relaxed text-lt-600'
export const mutedClass = 'text-lt-500'
export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'muted'
const badgeTones: Record<Tone, string> = { neutral: 'bg-lt-100 text-lt-700', brand: 'bg-brand/10 text-brand', success: 'bg-[#eef9f3] text-success', danger: 'bg-[#fff0f2] text-danger', muted: 'bg-lt-50 text-lt-500 ring-1 ring-lt-200 ring-inset' }
export const badgeClass = (tone: Tone) => `inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${badgeTones[tone]}`
export const stageTone = (stage: string): Tone => stage === 'won' ? 'success' : stage === 'lost' ? 'danger' : stage === 'new' ? 'neutral' : 'brand'
export const lifecycleTone = (lifecycle: string): Tone => lifecycle === 'customer' ? 'success' : lifecycle === 'qualified' ? 'brand' : lifecycle === 'inactive' ? 'muted' : 'neutral'
export const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?'
export const dealTotals = (deals: Deal[]) => [...new Set(deals.map((deal) => deal.currency))].map((currency) => money(deals.filter((deal) => deal.currency === currency).reduce((sum, deal) => sum + Number(deal.value), 0), currency))
export function money(value: string | number, currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)) }
export const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
