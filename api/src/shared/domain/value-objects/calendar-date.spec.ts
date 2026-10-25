import { unwrap, violationOf } from '@test/support/result.js';
import { CalendarDate } from './calendar-date.js';
import { YearMonth } from './year-month.js';

const d = (v: string) => unwrap<CalendarDate>(CalendarDate.parse(v));
const ym = (v: string) => unwrap<YearMonth>(YearMonth.parse(v));

describe('CalendarDate', () => {
  it('faz round trip sem deslocamento de fuso (CA23)', () => {
    expect(d('2026-10-31').toString()).toBe('2026-10-31');
    expect(d('2026-10-31').day).toBe(31);
    expect(d('2026-10-31').yearMonth.toString()).toBe('2026-10');
  });

  it.each([['2026-10-5'], ['26-10-05'], ['2026/10/05'], ['2026-10-05T00:00:00Z'], [''], ['abc'], [' 2026-10-05']])(
    'rejeita formato %j com INVALID_FORMAT',
    (input) => {
      expect(violationOf(CalendarDate.parse(input))).toBe('INVALID_FORMAT');
    },
  );

  it.each([
    ['2026-02-30'],
    ['2026-02-29'],
    ['2100-02-29'],
    ['2026-04-31'],
    ['2026-13-01'],
    ['2026-00-10'],
    ['2026-10-00'],
    ['2026-10-32'],
    ['0000-01-01'],
  ])('CA19: rejeita data inexistente %s com INVALID_DATE', (input) => {
    expect(violationOf(CalendarDate.parse(input))).toBe('INVALID_DATE');
  });

  it.each([['2028-02-29'], ['2000-02-29'], ['2026-12-31'], ['0001-01-01'], ['9999-12-31']])('aceita %s', (input) => {
    expect(d(input).toString()).toBe(input);
  });

  it('of(month, day) cria dentro do mes e viola invariante fora dele', () => {
    expect(CalendarDate.of(ym('2026-02'), 28).toString()).toBe('2026-02-28');
    expect(CalendarDate.of(ym('2028-02'), 29).toString()).toBe('2028-02-29');
    expect(() => CalendarDate.of(ym('2026-02'), 29)).toThrow();
    expect(() => CalendarDate.of(ym('2026-04'), 31)).toThrow();
    expect(() => CalendarDate.of(ym('2026-04'), 0)).toThrow();
    try {
      CalendarDate.of(ym('2026-02'), 30);
    } catch (e) {
      expect((e as Error).constructor.name).toBe('InvariantViolationError');
    }
  });

  it('compare, isAfter e equals', () => {
    expect(d('2026-10-05').compare(d('2026-10-06'))).toBe(-1);
    expect(d('2027-01-01').compare(d('2026-12-31'))).toBe(1);
    expect(d('2026-10-05').compare(d('2026-10-05'))).toBe(0);
    expect(d('2026-10-06').isAfter(d('2026-10-05'))).toBe(true);
    expect(d('2026-10-05').isAfter(d('2026-10-05'))).toBe(false);
    expect(d('2026-10-05').equals(d('2026-10-05'))).toBe(true);
  });
});
