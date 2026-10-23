import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { tavily } from '@tavily/core'
import { TAVILY_CLIENT } from './tavily.constants'
import { TavilySearchService } from './tavily-search.service'

@Module({
  providers: [
    {
      provide: TAVILY_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => tavily({
        apiKey: config.get<string>('TAVILY_API_KEY') || undefined,
        projectId: config.get<string>('TAVILY_PROJECT_ID') || undefined,
        clientSource: 'lead-trace-api',
      }),
    },
    TavilySearchService,
  ],
  exports: [TavilySearchService],
})
export class TavilyModule {}
