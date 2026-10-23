import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { LeadsService } from './leads.service'

// Searches live in PostgreSQL. A lease allows another API instance to recover a
// job after restart; no long discovery request is held open through the proxy.
@Injectable()
export class LeadDiscoveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadDiscoveryWorker.name)
  private timer?: NodeJS.Timeout
  private busy = false
  private stopping = false
  constructor(private readonly leads: LeadsService) {}
  onModuleInit() {
    this.timer = setInterval(() => { void this.tick() }, 3000)
    this.timer.unref()
    void this.tick()
  }
  onModuleDestroy() { this.stopping = true; if (this.timer) clearInterval(this.timer) }
  private async tick() {
    if (this.busy || this.stopping) return
    this.busy = true
    try { await this.leads.processNext() }
    catch (error) { this.logger.warn(error instanceof Error ? error.message : 'Lead discovery job failed') }
    finally { this.busy = false }
  }
}
