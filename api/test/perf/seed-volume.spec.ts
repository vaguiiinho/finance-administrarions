import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { ClosingDay, DueDay } from '@finance/domain/billing/day-of-month.js';
import { calculateInvoiceDates } from '@finance/domain/billing/calculate-invoice-dates.js';
import { unwrap } from '@test/support/result.js';
import { buildVolumeDataset } from './seed-volume.js';

/**
 * Contrato do gerador puro (ADR 0002 T4): `buildVolumeDataset()` devolve linhas ja no formato das colunas
 * (camelCase) sem tocar no banco. Determinismo, distribuicao e CHECKs da migration 3 sao verificados aqui, sem I/O.
 */
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const dataset = buildVolumeDataset();

describe('buildVolumeDataset - massa do RNF06', () => {
  it('100 mil lancamentos, 20 cartoes, 24 meses de referencia', () => {
    expect(dataset.entries).toHaveLength(100_000);
    expect(dataset.cards).toHaveLength(20);
    const months = new Set(dataset.entries.map((e) => e.referenceMonth));
    expect(months.size).toBeGreaterThanOrEqual(24);
  });

  it('e deterministico (PRNG com semente fixa): duas geracoes dao a mesma massa', () => {
    const again = buildVolumeDataset();
    expect(again.entries.slice(0, 500)).toEqual(dataset.entries.slice(0, 500));
    expect(again.cards).toEqual(dataset.cards);
  });

  it('ids sao UUID v7 e unicos', () => {
    expect(dataset.cards.every((c) => UUID_V7.test(c.id))).toBe(true);
    expect(dataset.entries.slice(0, 2000).every((e) => UUID_V7.test(e.id))).toBe(true);
    expect(new Set(dataset.entries.map((e) => e.id)).size).toBe(100_000);
  });

  it('distribuicao: ~15% receitas; ~40% das despesas no cartao; ~50% das despesas PIX pagas; ~10 categorias', () => {
    const incomes = dataset.entries.filter((e) => e.type === 'INCOME');
    const expenses = dataset.entries.filter((e) => e.type === 'EXPENSE');
    expect(incomes.length / 100_000).toBeGreaterThan(0.12);
    expect(incomes.length / 100_000).toBeLessThan(0.18);
    const card = expenses.filter((e) => e.paymentMethod === 'CARD');
    expect(card.length / expenses.length).toBeGreaterThan(0.35);
    expect(card.length / expenses.length).toBeLessThan(0.45);
    const pix = expenses.filter((e) => e.paymentMethod === 'PIX');
    const paidPix = pix.filter((e) => e.status === 'PAID').length / pix.length;
    expect(paidPix).toBeGreaterThan(0.45);
    expect(paidPix).toBeLessThan(0.55);
    const categories = new Set(dataset.entries.map((e) => e.category));
    expect(categories.size).toBeGreaterThanOrEqual(8);
    expect(categories.size).toBeLessThanOrEqual(12);
  });

  it('categoria tem grafia fixa por chave (category_key = minusculas da grafia unica)', () => {
    const spelling = new Map<string, Set<string>>();
    for (const e of dataset.entries) {
      spelling.set(e.categoryKey, (spelling.get(e.categoryKey) ?? new Set()).add(e.category));
    }
    for (const [key, names] of spelling) {
      expect(names.size, key).toBe(1);
      expect(key).toBe([...names][0].toLocaleLowerCase('pt-BR'));
    }
  });

  it('cartoes usam fechamento/vencimento variados, incluindo dias 29-31', () => {
    const days = [...dataset.cards.map((c) => c.closingDay), ...dataset.cards.map((c) => c.dueDay)];
    expect(new Set(days).size).toBeGreaterThan(6);
    expect(days.some((d) => d >= 29)).toBe(true);
    expect(new Set(dataset.cards.map((c) => c.nameKey)).size).toBe(20);
  });

  it('despesas no cartao: datas da fatura = calculateInvoiceDates e mes de referencia = mes do vencimento (CHECKs)', () => {
    const byId = new Map(dataset.cards.map((c) => [c.id, c]));
    const cardRows = dataset.entries.filter((e) => e.paymentMethod === 'CARD');
    for (const e of cardRows.filter((_, i) => i % 97 === 0)) {
      const card = byId.get(e.cardId!)!;
      const expected = calculateInvoiceDates(
        unwrap<CalendarDate>(CalendarDate.parse(e.date)),
        unwrap<ClosingDay>(ClosingDay.create(card.closingDay)),
        unwrap<DueDay>(DueDay.create(card.dueDay)),
      );
      expect(e.closingDate).toBe(expected.closingDate.toString());
      expect(e.dueDate).toBe(expected.dueDate.toString());
      expect(e.referenceMonth).toBe(`${expected.referenceMonth.toString()}-01`);
      expect(e.type).toBe('EXPENSE');
      expect(e.status === 'PENDING' || e.status === 'PAID').toBe(true);
    }
  });

  it('invariantes por tipo: receita = RECEIVED/PIX sem cartao; PIX sem datas de fatura; PAID tem paidAt', () => {
    for (const e of dataset.entries.filter((_, i) => i % 53 === 0)) {
      if (e.type === 'INCOME') {
        expect(e.status).toBe('RECEIVED');
        expect(e.cardId).toBeNull();
      }
      if (e.paymentMethod === 'PIX') {
        expect(e.cardId).toBeNull();
        expect(e.closingDate).toBeNull();
        expect(e.dueDate).toBeNull();
        expect(e.referenceMonth).toBe(`${e.date.slice(0, 7)}-01`);
      }
      if (e.status === 'PAID') expect(e.paidAt).not.toBeNull();
      expect(e.amount).toMatch(/^\d+\.\d{2}$/);
    }
  });
});
