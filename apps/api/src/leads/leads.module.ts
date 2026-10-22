import { Module } from '@nestjs/common'
import { CrmModule } from '../crm/crm.module'
import { TavilyModule } from '../tavily/tavily.module'
import { LeadExtractionService } from './lead-extraction.service'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'

@Module({ imports: [CrmModule, TavilyModule], providers: [LeadExtractionService, LeadsService], controllers: [LeadsController] })
export class LeadsModule {}
