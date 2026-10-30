import { Module } from '@nestjs/common';
import { MaintenanceScheduler } from './bootstrap/maintenance.scheduler.js';
import { parseMaintenanceInterval } from './bootstrap/env.js';
import { RefreshDemoDataset } from './modules/finance/application/demo/refresh-demo-dataset.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { PurgeExpiredSessions } from './modules/identity/application/use-cases/auth/purge-expired-sessions.js';
import { EnsureDemoUser } from './modules/identity/application/use-cases/bootstrap/ensure-demo-user.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { SharedModule } from './shared/shared.module.js';

/** Raiz de composição: a única que conhece os dois contextos (identity é registrado antes de finance). */
@Module({
  imports: [PrismaModule, SharedModule, IdentityModule, FinanceModule],
  providers: [
    {
      provide: MaintenanceScheduler,
      useFactory: (ensureDemo: EnsureDemoUser, refresh: RefreshDemoDataset, purge: PurgeExpiredSessions) =>
        new MaintenanceScheduler(parseMaintenanceInterval(process.env.MAINTENANCE_INTERVAL_MS), ensureDemo, refresh, purge),
      inject: [EnsureDemoUser, RefreshDemoDataset, PurgeExpiredSessions],
    },
  ],
})
export class AppModule {}
