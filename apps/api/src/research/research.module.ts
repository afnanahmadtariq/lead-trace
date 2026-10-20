import { Module } from '@nestjs/common'
import { LeadTraceAuthModule } from '../auth/lead-trace-auth.module'
import { TavilyModule } from '../tavily/tavily.module'
import { ResearchDiscoveryService } from './research-discovery.service'
import { WikipediaDiscoveryService } from './wikipedia-discovery.service'
import { ResearchLibraryController } from './research-library.controller'
import { ResearchLibraryService } from './research-library.service'
import { ResearchRunsController } from './research-runs.controller'
import { ResearchRunsService } from './research-runs.service'

@Module({
  imports: [LeadTraceAuthModule, TavilyModule],
  controllers: [ResearchRunsController, ResearchLibraryController],
  providers: [ResearchRunsService, ResearchDiscoveryService, ResearchLibraryService, WikipediaDiscoveryService],
})
export class ResearchModule {}
