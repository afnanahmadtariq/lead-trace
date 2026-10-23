import { Module } from '@nestjs/common'
import { LeadTraceAuthModule } from '../auth/lead-trace-auth.module'
import { CalendarService } from './calendar.service'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'

@Module({ imports: [LeadTraceAuthModule], controllers: [CrmController], providers: [CrmService, CalendarService], exports: [CrmService] })
export class CrmModule {}
