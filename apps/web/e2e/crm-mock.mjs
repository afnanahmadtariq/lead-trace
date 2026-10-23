// UI fixtures only. Provider, CSV, and permission behavior is tested by the API suite.
import { randomUUID } from 'node:crypto'
import { e2eFixtures } from './fixtures.mjs'
const contacts = new Map(), deals = new Map(), tasks = new Map(), notes = new Map(), meetings = new Map()
let connected = false
const owner = { id: 'e2e-user-id', name: e2eFixtures.user.name }
export function crmContact(id) { return contacts.get(id) }
export function crmResearchContact(body) {
  const contact = contacts.get(body.prospectId)
  if (contact) return contact
  const id = randomUUID()
  const record = { id, name: body.prospectName, email: body.prospectEmail ?? null, companyName: body.companyName ?? null, companyDomain: body.companyDomain ?? null, lifecycle: 'lead', _count: { researchRuns: 0, deals: 0 }, owner }
  contacts.set(id, record)
  return record
}
export async function handleCrm({ req, res, pathname, url, json, readBody, runs, webOrigin }) {
  const body = ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : {}
  if (pathname === '/crm/members') return json(res, 200, [owner])
  if (pathname === '/crm/calendar' && req.method === 'GET') return json(res, 200, { configured: true, connected, updatedAt: null })
  if (pathname === '/crm/calendar' && req.method === 'DELETE') { connected = false; return json(res, 200, { connected }) }
  if (pathname === '/crm/calendar/connect') { connected = true; return json(res, 200, { url: `${webOrigin}/dashboard/integrations?calendar=connected` }) }
  if (pathname === '/crm/calendar/meetings') {
    const meeting = { ...body, status: 'synced', organizerId: owner.id, htmlLink: 'https://www.google.com/calendar/event?eid=fixture' }
    meetings.set(body.id, meeting); return json(res, 200, meeting)
  }
  if (pathname === '/crm/contacts/export') return json(res, 200, { csv: ['name,email,company,domain,title,phone', ...[...contacts.values()].map((c) => [c.name, c.email, c.companyName, c.companyDomain, c.jobTitle, c.phone].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n') })
  if (pathname === '/crm/contacts/import') {
    let created = 0, skipped = 0
    const [header, ...rows] = body.csv.trim().split(/\r?\n/)
    for (const row of rows) {
      const record = Object.fromEntries(header.split(',').map((key, index) => [key, row.split(',')[index]]))
      if ([...contacts.values()].some((c) => c.email && c.email === record.email)) { skipped++; continue }
      const id = randomUUID(); contacts.set(id, { id, ...record, companyName: record.company, lifecycle: 'lead', owner, _count: { researchRuns: 0, deals: 0 } }); created++
    }
    return json(res, 200, { created, skipped })
  }
  if (pathname === '/crm/contacts' && req.method === 'GET') {
    const search = url.searchParams.get('q')?.toLowerCase() || '', page = Number(url.searchParams.get('page') || 1)
    const values = [...contacts.values()].filter((c) => `${c.name} ${c.email} ${c.companyName}`.toLowerCase().includes(search))
    return json(res, 200, { items: values.slice((page - 1) * 50, page * 50), total: values.length, page, pageSize: 50 })
  }
  if (pathname === '/crm/contacts' && req.method === 'POST') {
    if (body.email && [...contacts.values()].some((c) => c.email === body.email)) return json(res, 409, { message: 'A contact with this email already exists in this workspace' })
    const id = randomUUID(), contact = { id, ...body, owner: body.ownerId ? owner : null, _count: { researchRuns: 0, deals: 0 } }; contacts.set(id, contact); return json(res, 201, contact)
  }
  const id = pathname.split('/')[3]
  if (req.method === 'DELETE') {
    const store = { contacts, deals, notes, tasks }[pathname.split('/')[2]]
    if (!store?.has(id)) return json(res, 404, { message: 'Record not found' })
    if (store === contacts) {
      if ([...runs.values()].some((run) => run.prospect.id === id)) return json(res, 409, { message: 'This contact has research history. Delete is unavailable while research runs exist.' })
      for (const child of [deals, notes, tasks, meetings]) for (const [key, value] of child) if (value.prospectId === id) child.delete(key)
    }
    store.delete(id); return json(res, 200, { id })
  }
  if (/^\/crm\/contacts\/[^/]+\/notes$/.test(pathname)) { const note = { id: randomUUID(), prospectId: id, body: body.body, author: owner, createdAt: new Date().toISOString() }; notes.set(note.id, note); return json(res, 201, note) }
  if (/^\/crm\/contacts\/[^/]+$/.test(pathname)) {
    const contact = contacts.get(id); if (!contact) return json(res, 404, { message: 'Contact not found' })
    if (req.method === 'PATCH') { Object.assign(contact, body); return json(res, 200, contact) }
    return json(res, 200, { ...contact, deals: [...deals.values()].filter((d) => d.prospectId === id), notes: [...notes.values()].filter((n) => n.prospectId === id), tasks: [...tasks.values()].filter((t) => t.prospectId === id), meetings: [...meetings.values()].filter((m) => m.prospectId === id), researchRuns: [...runs.values()].filter((run) => run.prospect.id === id) })
  }
  if (pathname === '/crm/deals' && req.method === 'GET') return json(res, 200, { stages: ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], items: [...deals.values()] })
  if (pathname === '/crm/deals' && req.method === 'POST' || /^\/crm\/deals\/[^/]+$/.test(pathname)) { const dealId = id || randomUUID(); const deal = { ...body, id: dealId, owner: body.ownerId ? owner : null, prospect: contacts.get(body.prospectId) }; deals.set(dealId, deal); return json(res, 200, deal) }
  if (pathname === '/crm/tasks' && req.method === 'GET') return json(res, 200, [...tasks.values()])
  if (pathname === '/crm/tasks' && req.method === 'POST') { const task = { ...body, id: randomUUID(), owner, completedAt: null, prospect: contacts.get(body.prospectId) }; tasks.set(task.id, task); return json(res, 201, task) }
  if (/^\/crm\/tasks\/[^/]+$/.test(pathname)) { const task = tasks.get(id); task.completedAt = body.completed ? new Date().toISOString() : null; return json(res, 200, task) }
  return json(res, 404, { message: 'Unknown CRM fixture route' })
}
