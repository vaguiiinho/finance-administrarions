import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { FixedClock } from '@test/fakes/simple-fakes.js';
import { FakeDailyTimeCalculator, FakeShowcaseDataPurger } from '@test/fakes/maintenance-fakes.js';
import { unwrap } from '@test/support/result.js';
import { PurgeShowcaseData } from './purge-showcase-data.js';

const OWNER = '01900000-0000-7000-8000-0000000000d2';
const at3 = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse('03:00'));

/** CONTRATO ASSUMIDO (ADR 0011 5.4): `new PurgeShowcaseData(purger, clock, dailyTime, purgeAt)`. */
function setup(now: string) {
  const purger = new FakeShowcaseDataPurger();
  const dailyTime = new FakeDailyTimeCalculator();
  const useCase = new PurgeShowcaseData(purger as never, new FixedClock(new Date(now)), dailyTime as never, at3);
  return { purger, dailyTime, useCase };
}

describe('PurgeShowcaseData (B7, B9, ADR 0011 5.4)', () => {
  it('as 03:00:00 exatas de Sao Paulo (06:00Z) o corte e o proprio instante da execucao', async () => {
    const { purger, useCase } = setup('2026-11-03T06:00:00.000Z');
    await useCase.execute({ ownerId: OWNER });
    expect(purger.calls).toHaveLength(1);
    expect(purger.calls[0].before).toEqual(new Date('2026-11-03T06:00:00.000Z'));
  });

  it('as 02:59 de Sao Paulo o corte e o 03:00 do dia ANTERIOR (nao apaga o que foi criado hoje depois das 03:00)', async () => {
    const { purger, useCase } = setup('2026-11-03T05:59:00.000Z');
    await useCase.execute({ ownerId: OWNER });
    expect(purger.calls[0].before).toEqual(new Date('2026-11-02T06:00:00.000Z'));
  });

  it('as 14:00 de Sao Paulo (recuperacao no boot) o corte e o 03:00 do mesmo dia', async () => {
    const { purger, useCase } = setup('2026-11-03T17:00:00.000Z');
    await useCase.execute({ ownerId: OWNER });
    expect(purger.calls[0].before).toEqual(new Date('2026-11-03T06:00:00.000Z'));
  });

  it('repassa o dono recebido (finance nao conhece a conta demo) e usa o horario 03:00', async () => {
    const { purger, dailyTime, useCase } = setup('2026-11-03T06:00:00.000Z');
    await useCase.execute({ ownerId: OWNER });
    expect(String((purger.calls[0].ownerId as { value?: string })?.value ?? purger.calls[0].ownerId)).toBe(OWNER);
    expect(dailyTime.calls).toEqual([{ op: 'last', now: new Date('2026-11-03T06:00:00.000Z'), at: '3:0' }]);
  });

  it('devolve as contagens de lancamentos e cartoes apagados', async () => {
    const { purger, useCase } = setup('2026-11-03T06:00:00.000Z');
    purger.result = { entries: 5, cards: 1 };
    expect(await useCase.execute({ ownerId: OWNER })).toEqual({ entries: 5, cards: 1 });
  });

  it('idempotente: sem nada a apagar devolve zeros e nao lanca', async () => {
    const { useCase } = setup('2026-11-03T06:00:00.000Z');
    expect(await useCase.execute({ ownerId: OWNER })).toEqual({ entries: 0, cards: 0 });
    expect(await useCase.execute({ ownerId: OWNER })).toEqual({ entries: 0, cards: 0 });
  });

  it('propaga a falha do purger (o scheduler registra e tenta de novo na proxima execucao)', async () => {
    const { purger, useCase } = setup('2026-11-03T06:00:00.000Z');
    purger.failWith = new Error('db fora');
    await expect(useCase.execute({ ownerId: OWNER })).rejects.toThrow('db fora');
  });
});
