import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { db } from '@lead-trace/db'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AccountContextService, type AuthenticatedSession } from '../auth/account-context.service'
import { ContactDto, type DealDto, type TaskDto, stages } from './crm.dto'
import { contactsCsv, parseContactsCsv } from './csv'

const person = { select: { id: true, name: true } } as const
const contactInclude = { owner: person, _count: { select: { researchRuns: true, deals: true } } } as const

@Injectable()
export class CrmService {
  constructor(private readonly accounts: AccountContextService) {}

  async scope(session: AuthenticatedSession) {
    return (await this.accounts.assertActiveWorkspace(session)).organizationId
  }

  async contact(organizationId: string, id: string) {
    const contact = await db.prospect.findUnique({ where: { id_organizationId: { id, organizationId } } })
    if (!contact) throw new NotFoundException('Contact not found')
    return contact
  }

  async owner(organizationId: string, ownerId?: string | null) {
    if (ownerId && !await db.member.findUnique({ where: { organizationId_userId: { organizationId, userId: ownerId } } })) {
      throw new BadRequestException('Choose an owner from this workspace')
    }
    return ownerId || null
  }

  async members(session: AuthenticatedSession) {
    const organizationId = await this.scope(session)
    const members = await db.member.findMany({ where: { organizationId }, include: { user: person }, orderBy: { createdAt: 'asc' } })
    return members.map((member) => member.user)
  }

  async list(session: AuthenticatedSession, search = '', page = 1) {
    const organizationId = await this.scope(session)
    if (typeof search !== 'string' || !Number.isInteger(page) || page < 1 || page > 200000) throw new BadRequestException('Invalid page')
    const where = { organizationId, ...(search.trim() ? { OR: ['name', 'email', 'companyName'].map((key) => ({ [key]: { contains: search.trim().slice(0, 120), mode: 'insensitive' as const } })) } : {}) }
    const [items, total] = await db.$transaction([
      db.prospect.findMany({ where, include: contactInclude, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 50, skip: (page - 1) * 50 }),
      db.prospect.count({ where }),
    ])
    return { items, total, page, pageSize: 50 }
  }

  async detail(session: AuthenticatedSession, id: string) {
    const organizationId = await this.scope(session)
    const contact = await db.prospect.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        ...contactInclude,
        leadCandidates: { where: { status: 'converted' }, include: { source: true, search: { select: { id: true, title: true } } }, orderBy: { reviewedAt: 'desc' }, take: 20 },
        researchRuns: { orderBy: { requestedAt: 'desc' }, take: 50, include: { brief: { select: { id: true, title: true } } } },
        deals: { orderBy: { updatedAt: 'desc' }, take: 100, include: { owner: person } },
        notes: { orderBy: { createdAt: 'desc' }, take: 100, include: { author: person } },
        tasks: { orderBy: [{ completedAt: { sort: 'asc', nulls: 'first' } }, { dueAt: 'asc' }], take: 100, include: { owner: person } },
        meetings: { orderBy: { startsAt: 'desc' }, take: 100 },
      },
    })
    if (!contact) throw new NotFoundException('Contact not found')
    return contact
  }

  async saveContact(session: AuthenticatedSession, input: ContactDto, id?: string) {
    const organizationId = await this.scope(session)
    if (id) await this.contact(organizationId, id)
    const ownerId = await this.owner(organizationId, input.ownerId === undefined ? (id ? undefined : session.user.id) : input.ownerId)
    const email = input.email?.trim().toLowerCase() || null
    try {
      const data = { name: input.name, email, emailKey: email, companyName: input.companyName || null, companyDomain: input.companyDomain || null, jobTitle: input.jobTitle || null, phone: input.phone || null, lifecycle: input.lifecycle ?? 'lead', ...(input.ownerId !== undefined || !id ? { ownerId } : {}) }
      return id
        ? await db.prospect.update({ where: { id_organizationId: { id, organizationId } }, data, include: contactInclude })
        : await db.prospect.create({ data: { ...data, organizationId, createdById: session.user.id }, include: contactInclude })
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('A contact with this email already exists in this workspace')
      throw error
    }
  }

  async importContacts(session: AuthenticatedSession, csv: string) {
    const organizationId = await this.scope(session)
    const rows = parseContactsCsv(csv)
    const inputs = rows.map((row) => plainToInstance(ContactDto, { name: row.name, ...(row.email ? { email: row.email.toLowerCase() } : {}), companyName: row.company, companyDomain: row.domain, jobTitle: row.title, phone: row.phone }))
    for (const [index, input] of inputs.entries()) {
      if ((await validate(input)).length) throw new BadRequestException(`CSV row ${index + 2} contains invalid contact fields`)
    }
    // Atomic batch, existing email identities are preserved without overwriting CRM data.
    return db.$transaction(async (tx) => {
      let created = 0, skipped = 0
      for (const input of inputs) {
        if (input.email) {
          const result = await tx.prospect.createMany({ data: [{ ...input, emailKey: input.email, organizationId, createdById: session.user.id, ownerId: session.user.id }], skipDuplicates: true })
          created += result.count; skipped += 1 - result.count
        } else {
          await tx.prospect.create({ data: { ...input, organizationId, createdById: session.user.id, ownerId: session.user.id } }); created++
        }
      }
      return { created, skipped }
    }, { timeout: 15000 })
  }

  async exportContacts(session: AuthenticatedSession) {
    const organizationId = await this.scope(session)
    const count = await db.prospect.count({ where: { organizationId } })
    if (count > 10000) throw new BadRequestException('Export supports up to 10,000 contacts')
    return { csv: contactsCsv(await db.prospect.findMany({ where: { organizationId }, orderBy: { id: 'asc' }, take: 10000 })) }
  }

  async deals(session: AuthenticatedSession) {
    const organizationId = await this.scope(session)
    return { stages, items: await db.crmDeal.findMany({ where: { organizationId }, include: { prospect: { select: { id: true, name: true, companyName: true } }, owner: person }, orderBy: { updatedAt: 'desc' }, take: 500 }) }
  }

  async saveDeal(session: AuthenticatedSession, input: DealDto, id?: string) {
    const organizationId = await this.scope(session)
    await this.contact(organizationId, input.prospectId)
    const ownerId = await this.owner(organizationId, input.ownerId === undefined ? session.user.id : input.ownerId)
    const data = { ...input, organizationId, ownerId, expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null }
    if (id) {
      const updated = await db.crmDeal.updateMany({ where: { id, organizationId }, data })
      if (!updated.count) throw new NotFoundException('Deal not found')
      return { id }
    }
    return db.crmDeal.create({ data })
  }

  async note(session: AuthenticatedSession, id: string, body: string) {
    const organizationId = await this.scope(session)
    await this.contact(organizationId, id)
    return db.crmNote.create({ data: { organizationId, prospectId: id, authorId: session.user.id, body } })
  }

  async tasks(session: AuthenticatedSession) {
    const organizationId = await this.scope(session)
    return db.crmTask.findMany({ where: { organizationId }, include: { owner: person, prospect: { select: { id: true, name: true } } }, orderBy: [{ completedAt: { sort: 'asc', nulls: 'first' } }, { dueAt: 'asc' }], take: 500 })
  }

  async task(session: AuthenticatedSession, input: TaskDto) {
    const organizationId = await this.scope(session)
    await this.contact(organizationId, input.prospectId)
    const ownerId = await this.owner(organizationId, input.ownerId === undefined ? session.user.id : input.ownerId)
    return db.crmTask.create({ data: { ...input, organizationId, ownerId, dueAt: new Date(input.dueAt) } })
  }

  async completeTask(session: AuthenticatedSession, id: string, completed: boolean) {
    const organizationId = await this.scope(session)
    const updated = await db.crmTask.updateMany({ where: { id, organizationId }, data: { completedAt: completed ? new Date() : null } })
    if (!updated.count) throw new NotFoundException('Follow-up not found')
    return { id, completed }
  }
}
