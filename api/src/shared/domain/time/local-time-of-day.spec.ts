import { unwrap, violationOf } from '@test/support/result.js';
import { LocalTimeOfDay } from './local-time-of-day.js';

describe('LocalTimeOfDay.parse (ADR 0011 4)', () => {
  it.each([
    ['03:00', 3, 0],
    ['00:00', 0, 0],
    ['23:59', 23, 59],
    ['12:30', 12, 30],
  ])('aceita %s', (raw, hour, minute) => {
    const t = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse(raw));
    expect(t.hour).toBe(hour);
    expect(t.minute).toBe(minute);
  });

  it.each(['24:00', '3:00', '03:60', '03:0', '0300', '03-00', '', '03:00:00', ' 03:00', 'ab:cd', '-1:00', '25:00'])('rejeita %j', (raw) => {
    expect(violationOf(LocalTimeOfDay.parse(raw))).toBe('INVALID_FORMAT');
  });
});
