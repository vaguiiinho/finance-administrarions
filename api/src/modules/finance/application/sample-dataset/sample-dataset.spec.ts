import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { FixedClock, SequentialIdGenerator } from '@test/fakes/simple-fakes.js';
import { NOW } from '@test/support/builders.js';
import { ownerOf, owner } from '@test/support/owned-builders.js';
import { buildSampleDataset, SAMPLE_DATASET_VERSION } from './sample-dataset.js';

/**
 * Gerador do dataset de exemplo (ADR 0013 3.4, T5). O conteudo migra do antigo `buildDemoDataset` sem mudanca;
 * so o dono passa a ser a conta demo (CA17, CA29). CONTRATO: `buildSampleDataset({ ownerId, anchor, ids, now })`.
 */
const OWNER = owner(SHOWCASE_USER_ID);

const monthsEnding = (anchor: string, count: number): string[] => {
  const [y, m] = anchor.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) - (count - 1) + i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
};
const nextMonth = (anchor: string) => {
  const [y, m] = anchor.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

function build(anchor: string, now: Date = NOW) {
  const [y, m] = anchor.split('-').map(Number);
  return buildSampleDataset({ ownerId: OWNER, anchor: YearMonth.of(y, m), ids: new SequentialIdGenerator(), now: new FixedClock(now).now() });
}

describe('SAMPLE_DATASET_VERSION', () => {
  it('e um inteiro >= 1 (o conteudo nao mudou: continua 1, ADR 3.4)', () => {
    expect(Number.isInteger(SAMPLE_DATASET_VERSION)).toBe(true);
    expect(SAMPLE_DATASET_VERSION).toBe(1);
  });
});

describe('buildSampleDataset (CA17, CA29)', () => {
  it('2 cartoes com fechamento e vencimento diferentes, todos do dono informado', () => {
    const { cards } = build('2026-11');
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((c) => `${c.closingDay.value}/${c.dueDay.value}`)).size).toBe(2);
    expect(new Set(cards.map((c) => c.name.key)).size).toBe(2);
    for (const c of cards) expect(ownerOf(c as never)).toBe(SHOWCASE_USER_ID);
  });

  it('receitas e despesas PIX pagas e pendentes; pelo menos 5 categorias; tudo do dono informado', () => {
    const snaps = build('2026-11').entries.map((e) => e.toSnapshot());
    expect(snaps.some((s) => s.type === 'INCOME')).toBe(true);
    expect(snaps.some((s) => s.type === 'EXPENSE' && s.paymentMethod === 'PIX' && s.status === 'PAID')).toBe(true);
    expect(snaps.some((s) => s.type === 'EXPENSE' && s.paymentMethod === 'PIX' && s.status === 'PENDING')).toBe(true);
    expect(new Set(snaps.map((s) => s.category.key)).size).toBeGreaterThanOrEqual(5);
    for (const e of build('2026-11').entries) expect(ownerOf(e as never)).toBe(SHOWCASE_USER_ID);
  });

  it('despesas no cartao em pelo menos 2 faturas, sempre em cartao do proprio dataset', () => {
    const { cards, entries } = build('2026-11');
    const cardIds = new Set(cards.map((c) => c.id.value));
    const cardSnaps = entries.map((e) => e.toSnapshot()).filter((s) => s.paymentMethod === 'CARD');
    expect(new Set(cardSnaps.map((s) => `${s.cardId!.value}|${s.referenceMonth}`)).size).toBeGreaterThanOrEqual(2);
    for (const s of cardSnaps) expect(cardIds.has(s.cardId!.value)).toBe(true);
  });

  it.each(['2026-11', '2026-12', '2027-01', '2027-02'])(
    'cobre os 12 meses que terminam em %s e o mes seguinte (fatura futura) e nada fora disso',
    (anchor) => {
      const refs = build(anchor).entries.map((e) => e.toSnapshot().referenceMonth.toString());
      for (const month of monthsEnding(anchor, 12)) expect(refs, `mes ${month}`).toContain(month);
      const future = build(anchor)
        .entries.map((e) => e.toSnapshot())
        .filter((s) => s.paymentMethod === 'CARD' && s.referenceMonth.toString() === nextMonth(anchor));
      expect(future.length).toBeGreaterThanOrEqual(1);
      const allowed = new Set([...monthsEnding(anchor, 12), nextMonth(anchor)]);
      for (const ref of refs) expect(allowed.has(ref), `referencia fora da janela: ${ref}`).toBe(true);
    },
  );

  it('CA17: ancora 2026-11 vai de 2025-12 a 2026-11, mais a fatura de 2026-12', () => {
    const refs = new Set(build('2026-11').entries.map((e) => e.toSnapshot().referenceMonth.toString()));
    expect(refs.has('2025-12')).toBe(true);
    expect(refs.has('2026-12')).toBe(true);
    expect(refs.has('2025-11')).toBe(false);
    expect(refs.has('2027-01')).toBe(false);
  });

  it('CA29: ancora 2026-12 vai de 2026-01 a 2026-12, mais a fatura de 2027-01', () => {
    const refs = new Set(build('2026-12').entries.map((e) => e.toSnapshot().referenceMonth.toString()));
    expect(refs.has('2026-01')).toBe(true);
    expect(refs.has('2027-01')).toBe(true);
    expect(refs.has('2025-12')).toBe(false);
  });

  it('valores e descricoes sao fixos: so as datas acompanham o mes', () => {
    const sig = (s: ReturnType<ReturnType<typeof build>['entries'][number]['toSnapshot']>) =>
      `${s.type}|${s.description.value}|${s.category.value}|${s.amount.toString()}`;
    const a = build('2026-11').entries.map((e) => sig(e.toSnapshot())).sort();
    const b = build('2027-02').entries.map((e) => sig(e.toSnapshot())).sort();
    expect(a).toEqual(b);
  });

  it('ids unicos e createdAt vindo do `now` recebido', () => {
    const { cards, entries } = build('2026-11');
    const ids = [...cards.map((c) => c.id.value), ...entries.map((e) => e.id.value)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of entries) expect(e.toSnapshot().createdAt).toEqual(NOW);
  });
});
