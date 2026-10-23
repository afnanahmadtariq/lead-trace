import { Module } from '@nestjs/common'
import { AccountContextController } from './account-context.controller'
import { AccountContextService } from './account-context.service'
import { AuthConfigController } from './auth-config.controller'
import { WorkspaceSettingsController } from './workspace-settings.controller'
import { WorkspaceSettingsService } from './workspace-settings.service'

@Module({
  controllers: [AccountContextController, AuthConfigController, WorkspaceSettingsController],
  providers: [AccountContextService, WorkspaceSettingsService],
  exports: [AccountContextService],
})
export class LeadTraceAuthModule {}
