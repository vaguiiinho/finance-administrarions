import { Logger, Module } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/application/ports/clock.js';
import { DAILY_TIME_CALCULATOR, type DailyTimeCalculator } from '@shared/application/ports/daily-time-calculator.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { DemoAccountResetRoutine, describeError, type DemoAccountResetReport } from './bootstrap/demo-account/demo-account-reset.routine.js';
import { MaintenanceScheduler } from './bootstrap/maintenance.scheduler.js';
import { MAINTENANCE_TASKS, type MaintenanceTask } from './bootstrap/maintenance-task.js';
import { parseMaintenanceInterval } from './bootstrap/env.js';
import { ResetOwnerData } from './modules/finance/application/use-cases/maintenance/reset-owner-data.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { PurgeExpiredSessions } from './modules/identity/application/use-cases/auth/purge-expired-sessions.js';
import { GetShowcaseAccountState } from './modules/identity/application/use-cases/bootstrap/get-showcase-account-state.js';
import { IdentityModule } from './modules/identity/identity.module.js';

import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { SharedModule } from './shared/shared.module.js';

/** Redefinição diária da conta demo: 03:00 America/Sao_Paulo (ADR 0013 B5; constante de código, não configurável). */
const DEMO_ACCOUNT_RESET_AT = unwrapPersisted(LocalTimeOfDay.parse('03:00'), 'DEMO_ACCOUNT_RESET_AT');

/** Relatório da rotina (RF19) no log: contagens e códigos, nunca conteúdo de lançamentos. */
export function logDemoAccountReset(report: DemoAccountResetReport): void {
  const logger = new Logger('DemoAccountReset');
  const line = JSON.stringify(report);
  if (report.outcome === 'failed') logger.error(line);
  else logger.log(line);
}

/** Raiz de composição: a única que conhece os dois contextos (identity é registrado antes de finance). */
@Module({
  imports: [PrismaModule, SharedModule, IdentityModule, FinanceModule],
  providers: [
    {
      provide: DemoAccountResetRoutine,
      useFactory: (accountState: GetShowcaseAccountState, resetOwnerData: ResetOwnerData, clock: Clock, dailyTime: DailyTimeCalculator) =>
        new DemoAccountResetRoutine(accountState, resetOwnerData, clock, dailyTime, DEMO_ACCOUNT_RESET_AT, SHOWCASE_USER_ID, logDemoAccountReset),
      inject: [GetShowcaseAccountState, ResetOwnerData, CLOCK, DAILY_TIME_CALCULATOR],
    },
    {
      provide: MAINTENANCE_TASKS,
      useFactory: (purgeSessions: PurgeExpiredSessions, demoAccount: DemoAccountResetRoutine): MaintenanceTask[] => [
        {
          name: 'purge-expired-sessions',
          schedule: { kind: 'interval' },
          run: async () => {
            const { deleted } = await purgeSessions.execute({});
            return deleted > 0 ? `sessões expiradas removidas: ${deleted}` : undefined;
          },
        },
        {
          name: 'reset-demo-account',
          schedule: { kind: 'daily', at: DEMO_ACCOUNT_RESET_AT },
          // A rotina decide se pula (R7) e já registrou o relatório; o agendador só recebe um erro sem a mensagem do banco.
          run: async (trigger) => {
            try {
              await demoAccount.run(trigger === 'startup' ? 'catch-up' : 'scheduled');
            } catch (error) {
              throw new Error(`falha na redefinição da conta demo (${describeError(error)})`);
            }
          },
        },
      ],
      inject: [PurgeExpiredSessions, DemoAccountResetRoutine],
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
