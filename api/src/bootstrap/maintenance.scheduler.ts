import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import type { RefreshDemoDataset } from '../modules/finance/application/demo/refresh-demo-dataset.js';
import type { PurgeExpiredSessions } from '../modules/identity/application/use-cases/auth/purge-expired-sessions.js';
import type { EnsureDemoUser } from '../modules/identity/application/use-cases/bootstrap/ensure-demo-user.js';

/** Manutenção periódica (ADR 0005 7.6): mantém a demo no mês corrente e apaga sessões expiradas. `0` desliga. */
export class MaintenanceScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly intervalMs: number,
    private readonly ensureDemoUser: EnsureDemoUser,
    private readonly refreshDemoDataset: RefreshDemoDataset,
    private readonly purgeExpiredSessions: PurgeExpiredSessions,
  ) {}

  onModuleInit(): void {
    if (this.intervalMs <= 0) return;
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Nunca lança: uma falha numa passada não derruba o processo nem impede a próxima. */
  async runOnce(): Promise<void> {
    try {
      await this.ensureDemoUser.execute({});
      await this.refreshDemoDataset.execute({ ownerId: DEMO_USER_ID });
      const { deleted } = await this.purgeExpiredSessions.execute({});
      if (deleted > 0) this.logger.log(`Sessões expiradas removidas: ${deleted}`);
    } catch (error) {
      this.logger.error(`Manutenção periódica falhou: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
