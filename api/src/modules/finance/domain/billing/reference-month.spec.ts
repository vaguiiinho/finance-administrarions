import { unwrap, violationOf } from '@test/support/result.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { ReferenceMonth } from './reference-month.js';

const d = (v: string) => unwrap<CalendarDate>(CalendarDate.parse(v));
const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));

describe('ReferenceMonth', () => {
  it.each([['2026-13'], ['2026-00'], ['2026-1'], ['abc'], [''], ['2026-10-01']])(
    'CA41/CA57: rejeita %j com INVALID_FORMAT',
    (input) => {
      expect(violationOf(ReferenceMonth.parse(input))).toBe('INVALID_FORMAT');
    },
  );

  it('parse/toString fazem round trip', () => {
    expect(rm('2026-11').toString()).toBe('2026-11');
    expect(rm('2026-11').yearMonth.toString()).toBe('2026-11');
  });

  it('of(YearMonth)', () => {
    const month = unwrap<YearMonth>(YearMonth.parse('2026-03'));
    expect(ReferenceMonth.of(month).toString()).toBe('2026-03');
  });

  it('CA21 linhas 21-22: forPix usa o mes da data (inclusive ultimo dia do mes)', () => {
    expect(ReferenceMonth.forPix(d('2026-10-31')).toString()).toBe('2026-10');
    expect(ReferenceMonth.forPix(d('2026-12-31')).toString()).toBe('2026-12');
    expect(ReferenceMonth.forPix(d('2026-01-01')).toString()).toBe('2026-01');
  });

  it('ofDueDate usa o mes do vencimento', () => {
    expect(ReferenceMonth.ofDueDate(d('2026-11-05')).toString()).toBe('2026-11');
    expect(ReferenceMonth.ofDueDate(d('2027-01-31')).toString()).toBe('2027-01');
  });

  it('minusMonths, compare, equals', () => {
    expect(rm('2026-10').minusMonths(11).toString()).toBe('2025-11');
    expect(rm('2026-10').compare(rm('2026-11'))).toBe(-1);
    expect(rm('2026-12').compare(rm('2026-11'))).toBe(1);
    expect(rm('2026-12').compare(rm('2026-12'))).toBe(0);
    expect(rm('2026-12').equals(rm('2026-12'))).toBe(true);
    expect(rm('2026-12').equals(rm('2026-11'))).toBe(false);
  });
});

describe('ReferenceMonth - faixa de negocio (anos 1900-9998)', () => {
  it.each([['1899-12'], ['0001-05'], ['9999-01'], ['9999-12']])('%s -> OUT_OF_RANGE', (input) => {
    expect(violationOf(ReferenceMonth.parse(input))).toBe('OUT_OF_RANGE');
  });

  it.each([['1900-01'], ['9998-12']])('%s e aceito e minusculos/next nao estouram', (input) => {
    const month = rm(input);
    expect(() => month.minusMonths(11)).not.toThrow();
    expect(() => month.yearMonth.next().next()).not.toThrow();
  });
});
