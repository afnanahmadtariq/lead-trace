import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common'
import { Session } from '@thallesp/nestjs-better-auth'
import type { AuthenticatedSession } from '../auth/account-context.service'
import { CalendarService } from './calendar.service'
import { CompleteTaskDto, ContactDto, DealDto, ImportContactsDto, MeetingDto, NoteDto, TaskDto } from './crm.dto'
import { CrmService } from './crm.service'

@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService, private readonly calendar: CalendarService) {}
  @Get('members') members(@Session() s: AuthenticatedSession) { return this.crm.members(s) }
  @Get('contacts') contacts(@Session() s: AuthenticatedSession, @Query('q') q?: string, @Query('page') page?: string) { return this.crm.list(s, q, page === undefined ? 1 : Number(page)) }
  @Post('contacts') createContact(@Session() s: AuthenticatedSession, @Body() body: ContactDto) { return this.crm.saveContact(s, body) }
  @Post('contacts/import') importContacts(@Session() s: AuthenticatedSession, @Body() body: ImportContactsDto) { return this.crm.importContacts(s, body.csv) }
  @Get('contacts/export') exportContacts(@Session() s: AuthenticatedSession) { return this.crm.exportContacts(s) }
  @Get('contacts/:id') contact(@Session() s: AuthenticatedSession, @Param('id') id: string) { return this.crm.detail(s, id) }
  @Patch('contacts/:id') saveContact(@Session() s: AuthenticatedSession, @Param('id') id: string, @Body() body: ContactDto) { return this.crm.saveContact(s, body, id) }
  @Delete('contacts/:id') deleteContact(@Session() s: AuthenticatedSession, @Param('id') id: string) { return this.crm.deleteContact(s, id) }
  @Post('contacts/:id/notes') note(@Session() s: AuthenticatedSession, @Param('id') id: string, @Body() body: NoteDto) { return this.crm.note(s, id, body.body) }
  @Get('deals') deals(@Session() s: AuthenticatedSession) { return this.crm.deals(s) }
  @Post('deals') createDeal(@Session() s: AuthenticatedSession, @Body() body: DealDto) { return this.crm.saveDeal(s, body) }
  @Patch('deals/:id') saveDeal(@Session() s: AuthenticatedSession, @Param('id') id: string, @Body() body: DealDto) { return this.crm.saveDeal(s, body, id) }
  @Delete('deals/:id') deleteDeal(@Session() s: AuthenticatedSession, @Param('id') id: string) { return this.crm.deleteDeal(s, id) }
  @Delete('notes/:id') deleteNote(@Session() s: AuthenticatedSession, @Param('id') id: string) { return this.crm.deleteNote(s, id) }
  @Delete('tasks/:id') deleteTask(@Session() s: AuthenticatedSession, @Param('id') id: string) { return this.crm.deleteTask(s, id) }
  @Get('tasks') tasks(@Session() s: AuthenticatedSession) { return this.crm.tasks(s) }
  @Post('tasks') task(@Session() s: AuthenticatedSession, @Body() body: TaskDto) { return this.crm.task(s, body) }
  @Patch('tasks/:id') completeTask(@Session() s: AuthenticatedSession, @Param('id') id: string, @Body() body: CompleteTaskDto) { return this.crm.completeTask(s, id, body.completed) }
  @Get('calendar') calendarStatus(@Session() s: AuthenticatedSession) { return this.calendar.status(s) }
  @Post('calendar/connect') calendarConnect(@Session() s: AuthenticatedSession) { return this.calendar.connect(s) }
  @Get('calendar/callback') async calendarCallback(@Session() s: AuthenticatedSession, @Query('state') state: string, @Query('code') code: string | undefined, @Query('error') error: string | undefined, @Res() response: { redirect: (url: string) => void }) {
    let destination: string
    try { destination = await this.calendar.callback(s, state, code, error) } catch { destination = this.calendar.destination('failed') }
    response.redirect(destination)
  }
  @Delete('calendar') calendarDisconnect(@Session() s: AuthenticatedSession) { return this.calendar.disconnect(s) }
  @Post('calendar/meetings') meeting(@Session() s: AuthenticatedSession, @Body() body: MeetingDto) { return this.calendar.meeting(s, body) }
}
