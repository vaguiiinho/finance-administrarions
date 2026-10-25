import { unwrap, violationOf } from '@test/support/result.js';
import { YearMonth } from './year-month.js';

const ym = (v: string) => unwrap<YearMonth>(YearMonth.parse(v));

describe('YearMonth', () => {
  it.each([['2026-13'], ['2026-00'], ['2026-1'], ['26-10'], ['2026/10'], ['abc'], [''], ['0000-01'], ['2026-10-01']])(
    'rejeita %j com INVALID_FORMAT',
    (input) => {
      expect(violationOf(YearMonth.parse(input))).toBe('INVALID_FORMAT');
    },
  );

  it('faz round trip em toString', () => {
    expect(ym('2026-10').toString()).toBe('2026-10');
    expect(ym('0001-01').toString()).toBe('0001-01');
    expect(ym('9999-12').toString()).toBe('9999-12');
  });

  it.each([
    ['2026-01', 31],
    ['2026-02', 28],
    ['2027-02', 28],
    ['2028-02', 29],
    ['2100-02', 28],
    ['2000-02', 29],
    ['2026-04', 30],
  ])('lengthInDays(%s) = %i', (month, days) => {
    expect(ym(month).lengthInDays()).toBe(days);
  });

  it('next vira o ano em dezembro', () => {
    expect(ym('2026-12').next().toString()).toBe('2027-01');
    expect(ym('2026-10').next().toString()).toBe('2026-11');
  });

  it('CA62: minusMonths(11) de 2026-10 = 2025-11', () => {
    expect(ym('2026-10').minusMonths(11).toString()).toBe('2025-11');
    expect(ym('2026-01').minusMonths(1).toString()).toBe('2025-12');
    expect(ym('2026-10').minusMonths(0).toString()).toBe('2026-10');
    expect(ym('2026-10').minusMonths(24).toString()).toBe('2024-10');
  });

  it('firstDay, compare e equals', () => {
    expect(ym('2026-10').firstDay().toString()).toBe('2026-10-01');
    expect(ym('2026-09').compare(ym('2026-10'))).toBe(-1);
    expect(ym('2027-01').compare(ym('2026-12'))).toBe(1);
    expect(ym('2026-10').compare(ym('2026-10'))).toBe(0);
    expect(ym('2026-10').equals(ym('2026-10'))).toBe(true);
    expect(ym('2026-10').equals(ym('2026-11'))).toBe(false);
  });
});
