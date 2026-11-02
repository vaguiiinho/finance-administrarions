import { Module } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/application/ports/clock.js';
import { DAILY_TIME_CALCULATOR, type DailyTimeCalculator } from '@shared/application/ports/daily-time-calculator.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { DEMO_USER_ID, SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { MaintenanceScheduler } from './bootstrap/maintenance.scheduler.js';
import { MAINTENANCE_TASKS, type MaintenanceTask } from './bootstrap/maintenance-task.js';
import { parseMaintenanceInterval } from './bootstrap/env.js';
import { RefreshDemoDataset } from './modules/finance/application/demo/refresh-demo-dataset.js';
import { SHOWCASE_DATA_PURGER, type ShowcaseDataPurger } from './modules/finance/application/ports/showcase-data-purger.js';
import { PurgeShowcaseData } from './modules/finance/application/use-cases/maintenance/purge-showcase-data.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { PurgeExpiredSessions } from './modules/identity/application/use-cases/auth/purge-expired-sessions.js';
import { EnsureDemoUser } from './modules/identity/application/use-cases/bootstrap/ensure-demo-user.js';
import { IdentityModule } from './modules/identity/identity.module.js';

import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { SharedModule } from './shared/shared.module.js';

/** Limpeza diária da conta de demonstração: 03:00 America/Sao_Paulo (B7; constante de código, não configurável). */
const SHOWCASE_PURGE_AT = unwrapPersisted(LocalTimeOfDay.parse('03:00'), 'SHOWCASE_PURGE_AT');

/** Raiz de composição: a única que conhece os dois contextos (identity é registrado antes de finance). */
@Module({
  imports: [PrismaModule, SharedModule, IdentityModule, FinanceModule],
  providers: [
    {
      provide: MAINTENANCE_TASKS,
      useFactory: (
        ensureDemo: EnsureDemoUser,
        refresh: RefreshDemoDataset,
        purgeSessions: PurgeExpiredSessions,
        purger: ShowcaseDataPurger,
        clock: Clock,
        dailyTime: DailyTimeCalculator,
      ): MaintenanceTask[] => {
        const purgeShowcase = new PurgeShowcaseData(purger, clock, dailyTime, SHOWCASE_PURGE_AT);
        return [
          {
            name: 'ensure-demo-user',
            schedule: { kind: 'interval' },
            run: async () => {
              await ensureDemo.execute({});
            },
          },
          {
            name: 'refresh-demo-dataset',
            schedule: { kind: 'interval' },
            run: async () => {
              await refresh.execute({ ownerId: DEMO_USER_ID });
            },
          },
          {
            name: 'purge-expired-sessions',
            schedule: { kind: 'interval' },
            run: async () => {
              const { deleted } = await purgeSessions.execute({});
              return deleted > 0 ? `sessões expiradas removidas: ${deleted}` : undefined;
            },
          },
          {
            name: 'purge-showcase-data',
            schedule: { kind: 'daily', at: SHOWCASE_PURGE_AT },
            run: async () => {
              const { entries, cards } = await purgeShowcase.execute({ ownerId: SHOWCASE_USER_ID });
              return `lançamentos removidos: ${entries}; cartões removidos: ${cards}`;
            },
          },
        ];
      },
      inject: [EnsureDemoUser, RefreshDemoDataset, PurgeExpiredSessions, SHOWCASE_DATA_PURGER, CLOCK, DAILY_TIME_CALCULATOR],
    },
    {
      provide: MaintenanceScheduler,
      useFactory: (tasks: MaintenanceTask[], clock: Clock, dailyTime: DailyTimeCalculator) =>
        new MaintenanceScheduler(parseMaintenanceInterval(process.env.MAINTENANCE_INTERVAL_MS), tasks, clock, dailyTime),
      inject: [MAINTENANCE_TASKS, CLOCK, DAILY_TIME_CALCULATOR],
    },
  ],
})
export class AppModule {}
