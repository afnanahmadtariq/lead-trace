import { BadGatewayException, BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { db } from '@lead-trace/db'
import { createHash, randomBytes } from 'node:crypto'
import type { AuthenticatedSession } from '../auth/account-context.service'
import { CrmService } from './crm.service'
import { decrypt, encrypt, integrationKey } from './calendar.crypto'
import type { MeetingDto } from './crm.dto'

const scope = 'https://www.googleapis.com/auth/calendar.events.owned'
type Tokens = { access_token: string; refresh_token: string; expiresAt: number }
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }
type State = { userId: string; sessionId: string; organizationId: string; verifier: string }
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

@Injectable()
export class CalendarService {
  constructor(private readonly crm: CrmService) {}

  private config() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    if (!clientId || !clientSecret || !process.env.INTEGRATION_ENCRYPTION_KEY) throw new ServiceUnavailableException('Google Calendar is awaiting server configuration')
    integrationKey()
    return { clientId, clientSecret, redirectUri: `${(process.env.BETTER_AUTH_URL || 'http://localhost:3001').replace(/\/$/, '')}/crm/calendar/callback` }
  }

  destination(result: 'connected' | 'cancelled' | 'failed') {
    const origin = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',')[0]!.trim().replace(/\/$/, '')
    return `${origin}/dashboard/integrations?calendar=${result}`
  }

  async status(session: AuthenticatedSession) {
    const organizationId = await this.crm.scope(session)
    const connection = await db.calendarConnection.findUnique({ where: { organizationId_userId: { organizationId, userId: session.user.id } }, select: { updatedAt: true } })
    let configured = false
    try { this.config(); configured = true } catch { /* Optional integration. */ }
    return { configured, connected: Boolean(connection), updatedAt: connection?.updatedAt ?? null }
  }

  async connect(session: AuthenticatedSession) {
    const organizationId = await this.crm.scope(session)
    const config = this.config()
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(48).toString('base64url')
    await db.verification.deleteMany({ where: { identifier: 'google-calendar-state', expiresAt: { lt: new Date() } } })
    await db.verification.create({ data: {
      id: digest(state), identifier: 'google-calendar-state',
      value: encrypt({ userId: session.user.id, sessionId: session.session.id, organizationId, verifier }, 'calendar-state'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    } })
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }
  }

  async callback(session: AuthenticatedSession, state: string, code?: string, error?: string) {
    const organizationId = await this.crm.scope(session)
    if (!state || state.length > 256) throw new BadRequestException('Calendar authorization expired; connect again')
    const record = await db.verification.findUnique({ where: { id: digest(state) } })
    if (!record || record.identifier !== 'google-calendar-state' || record.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Calendar authorization expired; connect again')
    const saved = decrypt<State>(record.value, 'calendar-state')
    if (saved.userId !== session.user.id || saved.sessionId !== session.session.id || saved.organizationId !== organizationId) throw new BadRequestException('Return to the same workspace and reconnect Calendar')
    const consumed = await db.verification.deleteMany({ where: { id: record.id, value: record.value, expiresAt: { gt: new Date() } } })
    if (!consumed.count) throw new BadRequestException('Calendar authorization has already been used')
    if (error) return this.destination('cancelled')
    if (!code || code.length > 4096) throw new BadRequestException('Missing Calendar authorization code')
    const config = this.config()
    const result = await this.token(new URLSearchParams({ code, code_verifier: saved.verifier, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }))
    if (!result.refresh_token || !result.scope?.split(' ').includes(scope)) throw new BadRequestException('Calendar permission was not granted; reconnect and allow access')
    const context = `${organizationId}:${session.user.id}`
    const encryptedTokens = encrypt({ access_token: result.access_token!, refresh_token: result.refresh_token, expiresAt: Date.now() + result.expires_in! * 1000 }, context)
    await db.calendarConnection.upsert({ where: { organizationId_userId: { organizationId, userId: session.user.id } }, create: { organizationId, userId: session.user.id, encryptedTokens }, update: { encryptedTokens } })
    return this.destination('connected')
  }

  private async token(body: URLSearchParams, revoked?: () => Promise<unknown>): Promise<TokenResponse> {
    let response: Response
    try { response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body, signal: AbortSignal.timeout(15000) }) }
    catch { throw new BadGatewayException('Google Calendar could not be reached; try again') }
    if (revoked && response.status === 400 && (await response.json().catch(() => null) as { error?: string } | null)?.error === 'invalid_grant') {
      await revoked()
      throw new BadRequestException('Google Calendar access was revoked; connect your Calendar again')
    }
    if (!response.ok) throw new BadRequestException('Calendar authorization is unavailable; reconnect your Google account')
    const tokens = await response.json() as TokenResponse
    if (!tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in! <= 0) throw new BadGatewayException('Google returned an incomplete authorization response')
    return tokens
  }

  private async accessToken(organizationId: string, userId: string) {
    const connection = await db.calendarConnection.findUnique({ where: { organizationId_userId: { organizationId, userId } } })
    if (!connection) throw new BadRequestException('Connect your Google Calendar in Integrations first')
    const context = `${organizationId}:${userId}`
    const tokens = decrypt<Tokens>(connection.encryptedTokens, context)
    if (tokens.expiresAt > Date.now() + 60000) return tokens.access_token
    const config = this.config()
    const result = await this.token(new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: tokens.refresh_token }), () => db.calendarConnection.deleteMany({ where: { organizationId, userId } }))
    const updated = { access_token: result.access_token!, refresh_token: result.refresh_token || tokens.refresh_token, expiresAt: Date.now() + result.expires_in! * 1000 }
    // Compare-and-swap avoids recreating a disconnected connection.
    const saved = await db.calendarConnection.updateMany({ where: { id: connection.id, encryptedTokens: connection.encryptedTokens }, data: { encryptedTokens: encrypt(updated, context) } })
    if (saved.count) return updated.access_token
    // A concurrent request refreshed first; reuse its token instead of failing.
    const current = await db.calendarConnection.findUnique({ where: { organizationId_userId: { organizationId, userId } } })
    if (!current) throw new ConflictException('Calendar connection changed; try again')
    return decrypt<Tokens>(current.encryptedTokens, context).access_token
  }

  async disconnect(session: AuthenticatedSession) {
    const organizationId = await this.crm.scope(session)
    // Remove local credentials; existing Google events are intentionally retained.
    await db.calendarConnection.deleteMany({ where: { organizationId, userId: session.user.id } })
    return { connected: false }
  }

  async meeting(session: AuthenticatedSession, input: MeetingDto) {
    const organizationId = await this.crm.scope(session)
    const contact = await this.crm.contact(organizationId, input.prospectId)
    const startsAt = new Date(input.startsAt), endsAt = new Date(input.endsAt)
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 24 * 3600000) throw new BadRequestException('Meeting end must be after its start and within 24 hours')
    if (input.inviteContact && !contact.email) throw new BadRequestException('Add a contact email before sending an invitation')
    const previous = await db.calendarMeeting.findUnique({ where: { id: input.id } })
    if (startsAt.getTime() <= Date.now() && !previous) throw new BadRequestException('Choose a future meeting time')
    const googleEventId = digest(input.id)
    const data = { ...input, organizationId, organizerId: session.user.id, startsAt, endsAt, googleEventId, attendeeEmail: input.inviteContact ? contact.email : null }
    let meeting
    try { meeting = await db.calendarMeeting.create({ data }) } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error
      meeting = await db.calendarMeeting.findUnique({ where: { id: input.id } })
      if (!meeting || meeting.organizationId !== organizationId || meeting.organizerId !== session.user.id || meeting.prospectId !== input.prospectId || meeting.title !== input.title || meeting.startsAt.getTime() !== startsAt.getTime() || meeting.endsAt.getTime() !== endsAt.getTime() || meeting.inviteContact !== input.inviteContact) throw new ConflictException('Meeting request ID already used; start a new request')
    }
    if (meeting.status === 'synced') return meeting
    const accessToken = await this.accessToken(organizationId, session.user.id)
    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    let response: Response
    try {
      // An unconfirmed event may already exist even after its scheduled start.
      // Reconcile it with Google instead of creating a new event in the past.
      if (startsAt.getTime() <= Date.now()) {
        response = await fetch(`${base}/${googleEventId}`, { headers, signal: AbortSignal.timeout(15000) })
        if (response.status === 404 || response.status === 410) throw new BadRequestException('This meeting was not scheduled; choose a future time and start a new request')
      } else response = await fetch(`${base}?sendUpdates=${meeting.inviteContact ? 'all' : 'none'}&conferenceDataVersion=1`, {
        method: 'POST', headers, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ id: googleEventId, summary: meeting.title, description: `Lead Trace contact: ${contact.name}${contact.companyName ? ` · ${contact.companyName}` : ''}`, start: { dateTime: startsAt.toISOString() }, end: { dateTime: endsAt.toISOString() },
          // Reuse this event's request ID on retries; every new event gets its own Meet room.
          conferenceData: { createRequest: { requestId: googleEventId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
          ...(meeting.attendeeEmail ? { attendees: [{ email: meeting.attendeeEmail }] } : {}) }),
      })
      if (response.status === 409) response = await fetch(`${base}/${googleEventId}`, { headers, signal: AbortSignal.timeout(15000) })
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new BadGatewayException('Google Calendar could not be reached. Retry this meeting to safely resume.')
    }
    if (!response.ok) throw new BadGatewayException('Meeting was not confirmed by Google. Check your Calendar connection and retry.')
    const event = await response.json() as { id?: string; htmlLink?: string; status?: string }
    if (event.id !== googleEventId || event.status === 'cancelled') throw new ConflictException('Google event is unavailable; create a new meeting request')
    const htmlLink = event.htmlLink?.startsWith('https://www.google.com/calendar/') || event.htmlLink?.startsWith('https://calendar.google.com/') ? event.htmlLink : null
    return db.calendarMeeting.update({ where: { id: meeting.id }, data: { htmlLink, status: 'synced' } })
  }
}
