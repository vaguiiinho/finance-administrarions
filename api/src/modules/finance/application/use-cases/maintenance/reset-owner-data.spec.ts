import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { SaoPauloBusinessCalendar } from '@shared/infrastructure/sao-paulo-business-calendar.js';
import { FixedClock, SequentialIdGenerator } from '@test/fakes/simple-fakes.js';
import { FakeOwnerDataResetStore } from '@test/fakes/maintenance-fakes.js';
import { rejected } from '@test/support/builders.js';
import { ownerOf } from '@test/support/owned-builders.js';
import { SAMPLE_DATASET_VERSION } from '../../sample-dataset/sample-dataset.js';
import { ResetOwnerData } from './reset-owner-data.js';

/**
 * ResetOwnerData (ADR 0013 5.4): substitui PurgeShowcaseData e RefreshDemoDataset; nao conhece "conta demo".
 * CONTRATO ASSUMIDO (a ADR nao fixa a ordem): `new ResetOwnerData(store, calendar, ids, clock)` e
 * `execute({ ownerId, withSample, condition })`, como o antigo RefreshDemoDataset. Ajuste so este `setup` se diferir.
 */
function setup(nowIso: string) {
  const clock = new FixedClock(new Date(nowIso));
  const store = new FakeOwnerDataResetStore();
  const useCase = new ResetOwnerData(store as never, new SaoPauloBusinessCalendar(clock), new SequentialIdGenerator(), clock);
  return { clock, store, useCase };
}
const ALWAYS = { kind: 'always' } as const;

describe('ResetOwnerData: dataset de exemplo (withSample = true)', () => {
  it('CA18/CA17: passa ao store a ancora = mes corrente de Sao Paulo e a versao do dataset', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z'); // 03:00 de 15/11 em SP
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS });
    expect(store.calls).toHaveLength(1);
    expect(store.calls[0].ownerId).toBe(SHOWCASE_USER_ID);
    expect(store.calls[0].request.sample).toMatchObject({ version: SAMPLE_DATASET_VERSION });
    expect(String(store.calls[0].request.sample!.anchor)).toBe('2026-11');
  });

  it('CA29: 03:00 de 2026-12-01 em SP (06:00Z) ancora em 2026-12', async () => {
    const { store, useCase } = setup('2026-12-01T06:00:00.000Z');
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS });
    expect(String(store.calls[0].request.sample!.anchor)).toBe('2026-12');
  });

  it('CA29/P06: 23:59 de 2026-11-30 em SP (02:59Z de 12-01) ainda ancora no mes anterior', async () => {
    const { store, useCase } = setup('2026-12-01T02:59:00.000Z');
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS });
    expect(String(store.calls[0].request.sample!.anchor)).toBe('2026-11');
  });

  it('RNF06: 23:30 de 2026-11-30 em SP (02:30Z de 12-01) ainda e novembro', async () => {
    const { store, useCase } = setup('2026-12-01T02:30:00.000Z');
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS });
    expect(String(store.calls[0].request.sample!.anchor)).toBe('2026-11');
  });

  it('o `build` entrega o dataset do dono pedido, ancorado na ancora, com createdAt = now (CA17)', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS });
    const dataset = store.calls[0].request.sample!.build();
    expect(dataset.cards).toHaveLength(2);
    expect(dataset.entries.length).toBeGreaterThan(0);
    for (const c of dataset.cards) expect(ownerOf(c as never)).toBe(SHOWCASE_USER_ID);
    for (const e of dataset.entries) {
      expect(ownerOf(e as never)).toBe(SHOWCASE_USER_ID);
      expect(e.toSnapshot().createdAt).toEqual(new Date('2026-11-15T06:00:00.000Z'));
    }
    const refs = new Set(dataset.entries.map((e) => e.toSnapshot().referenceMonth.toString()));
    expect(refs.has('2026-12')).toBe(true); // fatura do mes seguinte
    expect(refs.has('2025-12')).toBe(true);
  });
});

describe('ResetOwnerData: so apagar (withSample = false, conta inativa, CA28)', () => {
  it('sample = null e o resultado nao traz ancora', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    store.outcome = { status: 'reset', deleted: { entries: 3, cards: 1 }, restored: { entries: 0, cards: 0 } };
    const result = await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: false, condition: ALWAYS });
    expect(store.calls[0].request.sample).toBeNull();
    expect(result).toMatchObject({ status: 'reset', deleted: { entries: 3, cards: 1 }, restored: { entries: 0, cards: 0 }, anchor: null });
  });
});

describe('ResetOwnerData: repasse ao store', () => {
  it('`at` e o instante do Clock (nunca new Date() no adapter)', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS });
    expect(store.calls[0].request.at).toEqual(new Date('2026-11-15T06:00:00.000Z'));
  });

  it.each([
    [{ kind: 'always' }],
    [{ kind: 'not-reset-since', since: new Date('2026-11-15T06:00:00.000Z') }],
    [{ kind: 'sample-stale' }],
  ] as const)('repassa a condicao %j sem alterar', async (condition) => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: condition as never });
    expect(store.calls[0].request.condition).toEqual(condition);
  });

  it('devolve contagens e ancora quando o store redefiniu', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    store.outcome = { status: 'reset', deleted: { entries: 7, cards: 2 }, restored: { entries: 90, cards: 2 } };
    expect(await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS })).toEqual({
      status: 'reset',
      deleted: { entries: 7, cards: 2 },
      restored: { entries: 90, cards: 2 },
      anchor: '2026-11',
    });
  });

  it('repassa `skipped` (condicao falsa sob o lock)', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    store.outcome = { status: 'skipped' };
    expect(await useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: { kind: 'sample-stale' } })).toEqual({ status: 'skipped' });
  });

  it('propaga a falha do store (a rotina registra e relanca)', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    store.failWith = new Error('db fora');
    await expect(useCase.execute({ ownerId: SHOWCASE_USER_ID, withSample: true, condition: ALWAYS })).rejects.toThrow('db fora');
  });

  it('ownerId malformado e erro de programacao (InvariantViolationError) e o store nao e chamado', async () => {
    const { store, useCase } = setup('2026-11-15T06:00:00.000Z');
    const error = await rejected(useCase.execute({ ownerId: 'abc', withSample: true, condition: ALWAYS }));
    expect(error.name).toBe('InvariantViolationError');
    expect(store.calls).toHaveLength(0);
  });
});
