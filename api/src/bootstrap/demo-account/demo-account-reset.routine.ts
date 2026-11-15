import type { Clock } from '@shared/application/ports/clock.js';
import type { DailyTimeCalculator } from '@shared/application/ports/daily-time-calculator.js';
import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import type { ResetOwnerDataInput, ResetOwnerDataResult } from '../../modules/finance/application/use-cases/maintenance/reset-owner-data.js';
import type { ShowcaseAccountState } from '../../modules/identity/application/use-cases/bootstrap/get-showcase-account-state.js';

export type ResetOrigin = 'scheduled' | 'catch-up' | 'manual';

/** Interfaces estreitas (DIP): implementadas pelos use cases reais; fakes nos testes. */
export interface ShowcaseAccountStateQuery {
  execute(input: Record<string, never>): Promise<{ state: ShowcaseAccountState }>;
}
export interface OwnerDataResetter {
  execute(input: ResetOwnerDataInput): Promise<ResetOwnerDataResult>;
}

export interface Counts {
  entries: number;
  cards: number;
}

/** Relatório de uma execução (RF19): nunca contém conteúdo de lançamentos, senha nem a mensagem crua de um erro. */
export interface DemoAccountResetReport {
  origin: ResetOrigin;
  startedAt: Date;
  finishedAt: Date;
  /** `unknown` só quando a própria consulta do estado falhou. */
  accountState: ShowcaseAccountState | 'unknown';
  outcome: 'reset' | 'skipped' | 'failed';
  deleted: Counts;
  restored: Counts;
  /** B5: a rotina não revoga sessões; mantido no relatório por RF17/RF19. */
  revokedSessions: 0;
  /** Só em `failed`: código (Prisma/SQLSTATE) ou nome do erro, nunca a mensagem. */
  error?: string;
}

const NONE: Counts = { entries: 0, cards: 0 };

/**
 * Rotina da conta demo (ADR 0013 5.5; RF15-RF19): leva a conta demo de volta ao estado inicial (apaga tudo e restaura o
 * dataset de exemplo quando a conta está ativa). Process manager fino da raiz de composição: consulta o identity e chama o
 * finance, sem que um conheça o outro.
 */
export class DemoAccountResetRoutine {
  constructor(
    private readonly accountState: ShowcaseAccountStateQuery,
    private readonly resetter: OwnerDataResetter,
    private readonly clock: Clock,
    private readonly dailyTime: DailyTimeCalculator,
    private readonly resetAt: LocalTimeOfDay,
    private readonly ownerId: string,
    private readonly log: (report: DemoAccountResetReport) => void,
  ) {}

  /** Registra o relatório uma vez e, em falha, relança o erro original (o agendador e o script tratam). */
  async run(origin: ResetOrigin): Promise<DemoAccountResetReport> {
    const startedAt = this.clock.now();
    let accountState: DemoAccountResetReport['accountState'] = 'unknown';
    try {
      accountState = (await this.accountState.execute({})).state;
      let outcome: DemoAccountResetReport['outcome'] = 'skipped';
      let deleted = NONE;
      let restored = NONE;
      if (accountState !== 'absent') {
        const result = await this.resetter.execute({
          ownerId: this.ownerId,
          withSample: accountState === 'active',
          condition: this.conditionFor(origin, startedAt),
        });
        if (result.status === 'reset') {
          outcome = 'reset';
          deleted = { ...result.deleted };
          restored = { ...result.restored };
        }
      }
      return this.report({ origin, startedAt, accountState, outcome, deleted, restored });
    } catch (error) {
      this.report({ origin, startedAt, accountState, outcome: 'failed', deleted: NONE, restored: NONE, error: describeError(error) });
      throw error;
    }
  }

  private conditionFor(origin: ResetOrigin, now: Date): ResetOwnerDataInput['condition'] {
    if (origin === 'manual') return { kind: 'always' };
    return { kind: 'not-reset-since', since: this.dailyTime.lastOccurrence(now, this.resetAt) };
  }

  private report(partial: Omit<DemoAccountResetReport, 'finishedAt' | 'revokedSessions'>): DemoAccountResetReport {
    const report: DemoAccountResetReport = { ...partial, finishedAt: this.clock.now(), revokedSessions: 0 };
    this.log(report);
    return report;
  }
}

/** Código (Prisma/SQLSTATE) quando existe; senão o nome do erro. A mensagem pode conter valores do banco. */
export function describeError(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code.length > 0) return code;
  return error instanceof Error ? error.name : 'UnknownError';
}
