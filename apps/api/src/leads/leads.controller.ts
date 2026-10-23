import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Session } from '@thallesp/nestjs-better-auth'
import type { AuthenticatedSession } from '../auth/account-context.service'
import { ConvertLeadDto, CreateLeadSearchDto, ReviewLeadDto } from './leads.dto'
import { LeadsService } from './leads.service'

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}
  @Get('capabilities') capabilities(@Session() session: AuthenticatedSession) { return this.leads.capabilities(session) }
  @Get('searches') list(@Session() session: AuthenticatedSession, @Query('page') page?: string) { return this.leads.list(session, page === undefined ? 1 : Number(page)) }
  @Post('searches') @Throttle({ default: { limit: 5, ttl: 60000 } }) create(@Session() session: AuthenticatedSession, @Body() input: CreateLeadSearchDto) { return this.leads.create(session, input) }
  @Get('searches/:id') get(@Session() session: AuthenticatedSession, @Param('id') id: string) { return this.leads.get(session, id) }
  @Post('searches/:id/discover') @HttpCode(202) @Throttle({ default: { limit: 3, ttl: 60000 } }) discover(@Session() session: AuthenticatedSession, @Param('id') id: string) { return this.leads.requestDiscovery(session, id) }
  @Post('searches/:id/cancel') cancel(@Session() session: AuthenticatedSession, @Param('id') id: string) { return this.leads.cancel(session, id) }
  @Patch('candidates/:id') review(@Session() session: AuthenticatedSession, @Param('id') id: string, @Body() input: ReviewLeadDto) { return this.leads.review(session, id, input.status) }
  @Post('candidates/:id/convert') convert(@Session() session: AuthenticatedSession, @Param('id') id: string, @Body() input: ConvertLeadDto) { return this.leads.convert(session, id, input) }
}
