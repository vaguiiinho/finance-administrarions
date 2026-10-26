import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { unwrap } from '@test/support/result.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { calculateInvoiceDates } from './calculate-invoice-dates.js';
import { ClosingDay, DueDay } from './day-of-month.js';

const date = (v: string) => unwrap<CalendarDate>(CalendarDate.parse(v));
const closing = (n: number) => unwrap<ClosingDay>(ClosingDay.create(n));
const due = (n: number) => unwrap<DueDay>(DueDay.create(n));

// Oraculo independente (aritmetica de dias via Date.UTC, so no teste).
const lengthOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const serial = (y: number, m: number, dd: number) => Date.UTC(y, m - 1, dd) / 86_400_000;
const serialOf = (v: CalendarDate) => {
  const [y, m, dd] = v.toString().split('-').map(Number);
  return serial(y, m, dd);
};
const parts = (v: CalendarDate) => v.toString().split('-').map(Number) as [number, number, number];
const monthIndex = (v: CalendarDate) => {
  const [y, m] = parts(v);
  return y * 12 + (m - 1);
};
const effective = (day: number, y: number, m: number) => Math.min(day, lengthOf(y, m));

describe('calculateInvoiceDates - tabela CA21 (linhas 1-20)', () => {
  // [#, fecha, vence, compra, fechamento, vencimento, mesRef]
  const rows: [number, number, number, string, string, string, string][] = [
    [1, 25, 5, '2026-10-10', '2026-10-25', '2026-11-05', '2026-11'],
    [2, 25, 5, '2026-10-25', '2026-10-25', '2026-11-05', '2026-11'],
    [3, 25, 5, '2026-10-26', '2026-11-25', '2026-12-05', '2026-12'],
    [4, 3, 10, '2026-10-02', '2026-10-03', '2026-10-10', '2026-10'],
    [5, 3, 10, '2026-10-04', '2026-11-03', '2026-11-10', '2026-11'],
    [6, 5, 15, '2026-10-05', '2026-10-05', '2026-10-15', '2026-10'],
    [7, 10, 10, '2026-10-05', '2026-10-10', '2026-11-10', '2026-11'],
    [8, 25, 5, '2026-12-10', '2026-12-25', '2027-01-05', '2027-01'],
    [9, 25, 5, '2026-12-26', '2027-01-25', '2027-02-05', '2027-02'],
    [10, 3, 10, '2026-12-15', '2027-01-03', '2027-01-10', '2027-01'],
    [11, 31, 10, '2026-02-15', '2026-02-28', '2026-03-10', '2026-03'],
    [12, 31, 10, '2026-02-28', '2026-02-28', '2026-03-10', '2026-03'],
    [13, 31, 10, '2026-01-31', '2026-01-31', '2026-02-10', '2026-02'],
    [14, 30, 5, '2026-01-31', '2026-02-28', '2026-03-05', '2026-03'],
    [15, 30, 7, '2028-02-29', '2028-02-29', '2028-03-07', '2028-03'],
    [16, 29, 7, '2027-02-28', '2027-02-28', '2027-03-07', '2027-03'],
    [17, 20, 31, '2026-02-10', '2026-02-20', '2026-02-28', '2026-02'],
    [18, 31, 30, '2026-02-28', '2026-02-28', '2026-03-30', '2026-03'],
    [19, 31, 31, '2026-04-30', '2026-04-30', '2026-05-31', '2026-05'],
    [20, 28, 30, '2026-01-29', '2026-02-28', '2026-03-30', '2026-03'],
  ];

  it.each(rows)('linha #%i: fecha %i / vence %i, compra %s', (_n, c, v, purchase, expClosing, expDue, expRef) => {
    const result = calculateInvoiceDates(date(purchase), closing(c), due(v));
    expect(result.closingDate.toString()).toBe(expClosing);
    expect(result.dueDate.toString()).toBe(expDue);
    expect(result.referenceMonth.toString()).toBe(expRef);
  });
});

interface InvoiceDatesCase {
  date: string;
  closingDay: number;
  dueDay: number;
  closingDate: string;
  dueDate: string;
  referenceMonth: string;
}

// Fixture compartilhado com o stub do web (web/e2e/stub-api/invoice-dates.spec.ts): ADR 0002 T5.
const sharedCases = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../test/fixtures/invoice-dates.cases.json'), 'utf8'),
) as InvoiceDatesCase[];

describe('calculateInvoiceDates - fixture compartilhado (paridade com o stub do web, ADR 0002 T5)', () => {
  it('o fixture cobre ao menos a tabela CA21 (20 linhas)', () => {
    expect(sharedCases.length).toBeGreaterThanOrEqual(20);
  });

  it.each(sharedCases.map((c) => [c.date, c.closingDay, c.dueDay, c] as const))(
    'compra %s, fecha %i / vence %i',
    (_date, _c, _v, c) => {
      const result = calculateInvoiceDates(date(c.date), closing(c.closingDay), due(c.dueDay));
      expect(result.closingDate.toString()).toBe(c.closingDate);
      expect(result.dueDate.toString()).toBe(c.dueDate);
      expect(result.referenceMonth.toString()).toBe(c.referenceMonth);
    },
  );
});

describe('calculateInvoiceDates - exemplos nomeados', () => {
  it('CA05: fecha 10/vence 17 e fecha 20/vence 25 para 2026-10-15', () => {
    const before = calculateInvoiceDates(date('2026-10-15'), closing(10), due(17));
    expect([before.closingDate.toString(), before.dueDate.toString(), before.referenceMonth.toString()]).toEqual([
      '2026-11-10',
      '2026-11-17',
      '2026-11',
    ]);
    const after = calculateInvoiceDates(date('2026-10-15'), closing(20), due(25));
    expect([after.closingDate.toString(), after.dueDate.toString(), after.referenceMonth.toString()]).toEqual([
      '2026-10-20',
      '2026-10-25',
      '2026-10',
    ]);
  });

  it('CA22: 2026-10-26, fecha 25, vence 5 -> 25/11, 05/12, 2026-12', () => {
    const r = calculateInvoiceDates(date('2026-10-26'), closing(25), due(5));
    expect([r.closingDate.toString(), r.dueDate.toString(), r.referenceMonth.toString()]).toEqual([
      '2026-11-25',
      '2026-12-05',
      '2026-12',
    ]);
  });

  it('CA39: 2026-10-10 com fecha 25/vence 5 -> referencia 2026-11 (mes do vencimento)', () => {
    expect(calculateInvoiceDates(date('2026-10-10'), closing(25), due(5)).referenceMonth.toString()).toBe('2026-11');
  });

  it('CA63: 2026-09-10 com fecha 25/vence 5 -> referencia 2026-10', () => {
    const r = calculateInvoiceDates(date('2026-09-10'), closing(25), due(5));
    expect(r.closingDate.toString()).toBe('2026-09-25');
    expect(r.dueDate.toString()).toBe('2026-10-05');
    expect(r.referenceMonth.toString()).toBe('2026-10');
  });

  it('e pura: mesma entrada, mesma saida', () => {
    const a = calculateInvoiceDates(date('2026-10-10'), closing(25), due(5));
    const b = calculateInvoiceDates(date('2026-10-10'), closing(25), due(5));
    expect(a.equals(b)).toBe(true);
  });
});

describe('calculateInvoiceDates - propriedades (a), (b), (e) por varredura exaustiva 2026-2028', () => {
  it('vale para toda data x fechamento 1..31 x vencimento 1..31', () => {
    const closings = Array.from({ length: 31 }, (_, i) => closing(i + 1));
    const dues = Array.from({ length: 31 }, (_, i) => due(i + 1));
    const start = serial(2026, 1, 1);
    const end = serial(2028, 12, 31);
    let checked = 0;
    for (let s = start; s <= end; s++) {
      const dt = new Date(s * 86_400_000);
      const purchase = date(
        `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
      );
      const purchaseMonth = monthIndex(purchase);
      for (const c of closings) {
        for (const v of dues) {
          const r = calculateInvoiceDates(purchase, c, v);
          const cs = serialOf(r.closingDate);
          const ds = serialOf(r.dueDate);
          // (a)
          if (!(s <= cs && cs < ds)) throw new Error(`(a) falhou: ${purchase.toString()} c=${c.value} v=${v.value}`);
          // (b)
          const cm = monthIndex(r.closingDate);
          const dm = monthIndex(r.dueDate);
          if (!(cm === purchaseMonth || cm === purchaseMonth + 1)) throw new Error(`(b1) falhou: ${purchase.toString()}`);
          if (!(dm === cm || dm === cm + 1)) throw new Error(`(b2) falhou: ${purchase.toString()}`);
          // (e)
          if (r.referenceMonth.toString() !== r.dueDate.toString().slice(0, 7)) throw new Error(`(e) falhou: ${purchase.toString()}`);
          checked++;
        }
      }
    }
    expect(checked).toBe((end - start + 1) * 31 * 31);
  }, 120_000);
});

describe('calculateInvoiceDates - propriedades (c), (d), (f) com fast-check', () => {
  const dateArb = fc
    .record({
      y: fc.integer({ min: 2026, max: 2028 }),
      m: fc.integer({ min: 1, max: 12 }),
      dd: fc.integer({ min: 1, max: 31 }),
    })
    .map(({ y, m, dd }) => ({ y, m, dd: Math.min(dd, lengthOf(y, m)) }))
    .map(({ y, m, dd }) => date(`${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`));
  const dayArb = fc.integer({ min: 1, max: 31 });

  it('(c) os dias gravados sao os dias efetivos do cartao nos meses resultantes', () => {
    fc.assert(
      fc.property(dateArb, dayArb, dayArb, (purchase, c, v) => {
        const r = calculateInvoiceDates(purchase, closing(c), due(v));
        const [cy, cmo, cd] = parts(r.closingDate);
        const [dy, dmo, dd] = parts(r.dueDate);
        expect(cd).toBe(effective(c, cy, cmo));
        expect(dd).toBe(effective(v, dy, dmo));
      }),
      { numRuns: 2000 },
    );
  });

  it('(d) minimalidade: nenhum fechamento efetivo >= compra nem vencimento efetivo > fechamento e anterior', () => {
    fc.assert(
      fc.property(dateArb, dayArb, dayArb, (purchase, c, v) => {
        const r = calculateInvoiceDates(purchase, closing(c), due(v));
        const ps = serialOf(purchase);
        const [py, pm] = parts(purchase);
        // candidatos de fechamento a partir do mes da compra
        for (let k = 0; k < 3; k++) {
          const idx = py * 12 + (pm - 1) + k;
          const y = Math.floor(idx / 12);
          const m = (idx % 12) + 1;
          const cand = serial(y, m, effective(c, y, m));
          if (cand >= ps && cand < serialOf(r.closingDate)) throw new Error('fechamento nao minimo');
        }
        const [cy, cmo] = parts(r.closingDate);
        for (let k = 0; k < 3; k++) {
          const idx = cy * 12 + (cmo - 1) + k;
          const y = Math.floor(idx / 12);
          const m = (idx % 12) + 1;
          const cand = serial(y, m, effective(v, y, m));
          if (cand > serialOf(r.closingDate) && cand < serialOf(r.dueDate)) throw new Error('vencimento nao minimo');
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('(f) monotonicidade: compra posterior no mesmo cartao nunca vence antes', () => {
    fc.assert(
      fc.property(dateArb, dateArb, dayArb, dayArb, (a, b, c, v) => {
        const [first, second] = serialOf(a) <= serialOf(b) ? [a, b] : [b, a];
        const r1 = calculateInvoiceDates(first, closing(c), due(v));
        const r2 = calculateInvoiceDates(second, closing(c), due(v));
        expect(serialOf(r2.dueDate)).toBeGreaterThanOrEqual(serialOf(r1.dueDate));
        expect(serialOf(r2.closingDate)).toBeGreaterThanOrEqual(serialOf(r1.closingDate));
      }),
      { numRuns: 2000 },
    );
  });
});
