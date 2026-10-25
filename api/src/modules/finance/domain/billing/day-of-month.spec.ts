import { unwrap, violationOf } from '@test/support/result.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { ClosingDay, DueDay } from './day-of-month.js';

const ym = (v: string) => unwrap<YearMonth>(YearMonth.parse(v));

describe.each([
  ['ClosingDay', (n: number) => ClosingDay.create(n)],
  ['DueDay', (n: number) => DueDay.create(n)],
])('%s', (_name, create) => {
  it.each([[1], [10], [25], [31]])('aceita %i', (n) => {
    expect(unwrap<{ value: number }>(create(n)).value).toBe(n);
  });

  it.each([[0], [32], [-1], [100]])('CA02: %i fora de 1..31 -> OUT_OF_RANGE', (n) => {
    expect(violationOf(create(n))).toBe('OUT_OF_RANGE');
  });

  it.each([[10.5], [0.1], [Number.NaN]])('CA02: %s nao inteiro -> NOT_INTEGER', (n) => {
    expect(violationOf(create(n))).toBe('NOT_INTEGER');
  });

  it.each([
    [31, '2026-02', 28],
    [31, '2028-02', 29],
    [31, '2026-04', 30],
    [31, '2026-01', 31],
    [30, '2026-02', 28],
    [30, '2028-02', 29],
    [29, '2026-02', 28],
    [29, '2027-02', 28],
    [29, '2028-02', 29],
    [28, '2026-02', 28],
    [15, '2026-02', 15],
    [1, '2026-04', 1],
  ])('dia %i em %s -> efetivo %i', (day, month, expected) => {
    const dayOfMonth = unwrap<{ effectiveIn(m: YearMonth): number }>(create(day));
    expect(dayOfMonth.effectiveIn(ym(month))).toBe(expected);
  });
});
