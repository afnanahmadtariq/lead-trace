import { Module } from '@nestjs/common'
import { CrmModule } from '../crm/crm.module'
import { TavilyModule } from '../tavily/tavily.module'
import { LeadExtractionService } from './lead-extraction.service'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { LeadDeepDiscoveryService } from './lead-deep-discovery.service'
import { LeadRegistriesService } from './lead-registries.service'
import { LeadCompanyPlanner } from './lead-company-planner.service'
import { LeadDiscoveryWorker } from './lead-discovery-worker'

@Module({ imports: [CrmModule, TavilyModule], providers: [LeadExtractionService, LeadRegistriesService, LeadCompanyPlanner, LeadDeepDiscoveryService, LeadsService, LeadDiscoveryWorker], controllers: [LeadsController] })
export class LeadsModule {}
