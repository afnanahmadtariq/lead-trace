import { Controller, Get, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AllowAnonymous, AuthModule } from '@thallesp/nestjs-better-auth'
import { resolve } from 'node:path'
import { auth } from './auth/auth'
import { LeadTraceAuthModule } from './auth/lead-trace-auth.module'
import { validateEnvironment } from './config/env.validation'
import { E2eModule } from './e2e/e2e.module'
import { LeadsModule } from './leads/leads.module'
import { CrmModule } from './crm/crm.module'
import { ResearchModule } from './research/research.module'

const e2eEnabled = process.env.E2E_ENABLED === 'true'

@Controller()
class HealthController {
  @Get('health')
  @AllowAnonymous()
  health() {
    return { status: 'ok' }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '1mb' },
        urlencoded: { limit: '1mb', extended: true },
      },
    }),
    LeadTraceAuthModule,
    ResearchModule,
    CrmModule,
    LeadsModule,
    ...(e2eEnabled ? [E2eModule] : []),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
