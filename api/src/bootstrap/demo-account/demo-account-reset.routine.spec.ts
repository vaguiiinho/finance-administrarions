import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { SaoPauloDailyTimeCalculator } from '@shared/infrastructure/sao-paulo-daily-time-calculator.js';
import { FixedClock } from '@test/fakes/simple-fakes.js';
import { rejected } from '@test/support/builders.js';
import { unwrap } from '@test/support/result.js';
import { DemoAccountResetRoutine, type DemoAccountResetReport, type ResetOrigin } from './demo-account-reset.routine.js';

/**
 * Rotina da conta demo (ADR 0013 5.5; RF15-RF19, B5, T9). Orquestracao pura sobre fakes: consulta o estado da conta,
 * escolhe `withSample` e a condicao pela origem e registra o relatorio. Relogio falso em horario de Sao Paulo (UTC-3).
 */
const at3 = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse('03:00'));
type State = 'active' | 'inactive' | 'absent';
type ResetResult =
  | { status: 'skipped' }
  | { status: 'reset'; deleted: { entries: number; cards: number }; restored: { entries: number; cards: number }; anchor: string | null };

function setup(nowIso: string, state: State = 'active') {
  const clock = new FixedClock(new Date(nowIso));
  const stateCalls: unknown[] = [];
  const resetCalls: { ownerId: string; withSample: boolean; condition: any }[] = [];
  const fakes = {
    state: state as State,
    result: { status: 'reset', deleted: { entries: 4, cards: 1 }, restored: { entries: 90, cards: 2 }, anchor: '2026-11' } as ResetResult,
    failWith: null as Error | null,
    advanceMsDuringReset: 0,
  };
  const accountState = {
    execute: async (input: object) => {
      stateCalls.push(input);
      return { state: fakes.state };
    },
  };
  const resetter = {
    execute: async (input: { ownerId: string; withSample: boolean; condition: unknown }) => {
      resetCalls.push(input as never);
      if (fakes.advanceMsDuringReset) clock.set(new Date(clock.now().getTime() + fakes.advanceMsDuringReset));
      if (fakes.failWith) throw fakes.failWith;
      return fakes.result;
    },
  };
  const reports: DemoAccountResetReport[] = [];
  const routine = new DemoAccountResetRoutine(
    accountState as never,
    resetter as never,
    clock,
    new SaoPauloDailyTimeCalculator(),
    at3,
    SHOWCASE_USER_ID,
    (report) => reports.push(report),
  );
  return { routine, fakes, reports, resetCalls, stateCalls, clock };
}
const run = (r: ReturnType<typeof setup>, origin: ResetOrigin) => r.routine.run(origin);

describe('DemoAccountResetRoutine: conta ativa (RF14, RF15, B2)', () => {
  it('CA18: agendada as 03:00 de 2026-11-15 em SP (06:00Z) restaura o dataset, so para o dono da conta demo, com `since` = o proprio 03:00', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    await run(r, 'scheduled');
    expect(r.resetCalls).toEqual([
      { ownerId: SHOWCASE_USER_ID, withSample: true, condition: { kind: 'not-reset-since', since: new Date('2026-11-15T06:00:00.000Z') } },
    ]);
  });

  it('devolve o relatorio com origem, estado, desfecho, contagens e revokedSessions = 0 (B5, CA24)', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    const report = await run(r, 'scheduled');
    expect(report).toMatchObject({
      origin: 'scheduled',
      accountState: 'active',
      outcome: 'reset',
      deleted: { entries: 4, cards: 1 },
      restored: { entries: 90, cards: 2 },
      revokedSessions: 0,
    });
    expect(report.startedAt).toEqual(new Date('2026-11-15T06:00:00.000Z'));
    expect(report.finishedAt).toBeInstanceOf(Date);
  });

  it('RF19: finishedAt reflete o fim da execucao (relogio avancou durante a redefinicao)', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    r.fakes.advanceMsDuringReset = 2_500;
    const report = await run(r, 'scheduled');
    expect(report.finishedAt.getTime() - report.startedAt.getTime()).toBe(2_500);
  });

  it('CA22: idempotente: rodar de novo nao falha e repassa o desfecho do store a cada vez', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    await run(r, 'scheduled');
    r.fakes.result = { status: 'skipped' };
    const second = await run(r, 'scheduled');
    expect(second.outcome).toBe('skipped');
    expect(r.resetCalls).toHaveLength(2);
  });

  it('desfecho `skipped` do store vira outcome skipped, sem contagens', async () => {
    const r = setup('2026-11-15T18:00:00.000Z');
    r.fakes.result = { status: 'skipped' };
    const report = await run(r, 'catch-up');
    expect(report).toMatchObject({ outcome: 'skipped', deleted: { entries: 0, cards: 0 }, restored: { entries: 0, cards: 0 }, revokedSessions: 0 });
  });
});

describe('DemoAccountResetRoutine: condicao por origem (RF16, R7, CA25, CA27)', () => {
  it('manual -> always, em qualquer horario (14:00 de 2026-11-20 em SP = 17:00Z)', async () => {
    const r = setup('2026-11-20T17:00:00.000Z');
    await run(r, 'manual');
    expect(r.resetCalls[0]).toMatchObject({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: { kind: 'always' } });
  });

  it('manual: o relatorio traz origin = manual (CA25)', async () => {
    const r = setup('2026-11-20T17:00:00.000Z');
    expect((await run(r, 'manual')).origin).toBe('manual');
    expect(r.reports[0].origin).toBe('manual');
  });

  it.each([
    ['02:59 de SP (05:59Z): o 03:00 de ONTEM', '2026-11-15T05:59:00.000Z', '2026-11-14T06:00:00.000Z'],
    ['03:00:00 em ponto: o proprio instante', '2026-11-15T06:00:00.000Z', '2026-11-15T06:00:00.000Z'],
    ['15:00 de SP (subida do deploy no meio do dia, R7): o 03:00 de HOJE', '2026-11-15T18:00:00.000Z', '2026-11-15T06:00:00.000Z'],
    ['04:00 de SP depois de perder as 03:00 (CA27): o 03:00 de HOJE', '2026-11-15T07:00:00.000Z', '2026-11-15T06:00:00.000Z'],
    ['23:59 de SP: o 03:00 de HOJE', '2026-11-16T02:59:00.000Z', '2026-11-15T06:00:00.000Z'],
  ])('catch-up, %s', async (_label, now, since) => {
    const r = setup(now);
    await run(r, 'catch-up');
    expect(r.resetCalls[0].condition).toEqual({ kind: 'not-reset-since', since: new Date(since) });
  });

  it('scheduled e catch-up usam a mesma condicao para o mesmo instante', async () => {
    const a = setup('2026-11-15T07:00:00.000Z');
    const b = setup('2026-11-15T07:00:00.000Z');
    await run(a, 'scheduled');
    await run(b, 'catch-up');
    expect(a.resetCalls[0].condition).toEqual(b.resetCalls[0].condition);
  });

  it('o 03:00 e o de Sao Paulo, nao o UTC: as 03:00Z (00:00 SP) o corte e o 06:00Z de ontem', async () => {
    const r = setup('2026-11-15T03:00:00.000Z');
    await run(r, 'scheduled');
    expect(r.resetCalls[0].condition.since).toEqual(new Date('2026-11-14T06:00:00.000Z'));
  });

  it('CA29: 03:00 de 2026-12-01 em SP: a condicao e o proprio instante (a ancora do dataset e decidida pelo ResetOwnerData)', async () => {
    const r = setup('2026-12-01T06:00:00.000Z');
    await run(r, 'scheduled');
    expect(r.resetCalls[0].condition).toEqual({ kind: 'not-reset-since', since: new Date('2026-12-01T06:00:00.000Z') });
  });
});

describe('DemoAccountResetRoutine: conta inativa ou ausente (P13, CA28)', () => {
  it('CA28: inativa -> chama a redefinicao SEM dataset (so apaga o que existir), nao reativa nada', async () => {
    const r = setup('2026-11-15T06:00:00.000Z', 'inactive');
    r.fakes.result = { status: 'reset', deleted: { entries: 2, cards: 0 }, restored: { entries: 0, cards: 0 }, anchor: null };
    const report = await run(r, 'scheduled');
    expect(r.resetCalls).toHaveLength(1);
    expect(r.resetCalls[0]).toMatchObject({ ownerId: SHOWCASE_USER_ID, withSample: false });
    expect(report).toMatchObject({ accountState: 'inactive', outcome: 'reset', restored: { entries: 0, cards: 0 } });
  });

  it('inativa + manual: tambem sem dataset, condicao always', async () => {
    const r = setup('2026-11-20T17:00:00.000Z', 'inactive');
    await run(r, 'manual');
    expect(r.resetCalls[0]).toMatchObject({ withSample: false, condition: { kind: 'always' } });
  });

  it('ausente -> nada e chamado (nao ha dono para apagar), outcome skipped, ainda registra em log', async () => {
    const r = setup('2026-11-15T06:00:00.000Z', 'absent');
    const report = await run(r, 'scheduled');
    expect(r.resetCalls).toHaveLength(0);
    expect(report).toMatchObject({ accountState: 'absent', outcome: 'skipped', deleted: { entries: 0, cards: 0 }, restored: { entries: 0, cards: 0 } });
    expect(r.reports).toHaveLength(1);
  });

  it('o estado e consultado a cada execucao', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    await run(r, 'scheduled');
    r.fakes.state = 'inactive';
    await run(r, 'manual');
    expect(r.stateCalls).toHaveLength(2);
    expect(r.resetCalls.map((c) => c.withSample)).toEqual([true, false]);
  });
});

describe('DemoAccountResetRoutine: falha (CA21, RF19)', () => {
  it('registra outcome failed UMA vez e relanca o erro (o agendador e o script tratam)', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    r.fakes.failWith = new Error('db fora');
    const error = await rejected(run(r, 'scheduled'));
    expect(error.message).toBe('db fora');
    expect(r.reports).toHaveLength(1);
    expect(r.reports[0]).toMatchObject({ origin: 'scheduled', outcome: 'failed', accountState: 'active', revokedSessions: 0 });
  });

  it('a falha nao vaza a mensagem do erro para o log (so codigo/nome), sem dados sensiveis', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    r.fakes.failWith = new Error('duplicate key value violates ... (description)=(Salario da Maria)');
    await rejected(run(r, 'manual'));
    expect(JSON.stringify(r.reports[0])).not.toContain('Salario da Maria');
  });

  it('a proxima execucao tenta de novo normalmente', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    r.fakes.failWith = new Error('db fora');
    await rejected(run(r, 'scheduled'));
    r.fakes.failWith = null;
    expect((await run(r, 'manual')).outcome).toBe('reset');
    expect(r.reports.map((x) => x.outcome)).toEqual(['failed', 'reset']);
  });
});

describe('DemoAccountResetRoutine: log (RF19, RNF10)', () => {
  it('um relatorio por execucao, com os campos acordados e nenhum conteudo de lancamentos nem senha', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    await run(r, 'scheduled');
    expect(r.reports).toHaveLength(1);
    for (const key of ['accountState', 'deleted', 'finishedAt', 'origin', 'outcome', 'restored', 'revokedSessions', 'startedAt']) {
      expect(r.reports[0], key).toHaveProperty(key);
    }
    expect(JSON.stringify(r.reports[0])).not.toMatch(/password|senha|description|descri/i);
  });

  it('o relatorio devolvido e o mesmo que foi registrado', async () => {
    const r = setup('2026-11-15T06:00:00.000Z');
    expect(await run(r, 'scheduled')).toEqual(r.reports[0]);
  });
});
