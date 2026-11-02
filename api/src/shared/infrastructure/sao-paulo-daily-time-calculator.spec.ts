import { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { unwrap } from '@test/support/result.js';
import { SaoPauloDailyTimeCalculator } from './sao-paulo-daily-time-calculator.js';

const at3 = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse('03:00'));
const calc = new SaoPauloDailyTimeCalculator();
const iso = (d: Date) => d.toISOString();

describe('SaoPauloDailyTimeCalculator (ADR 0011 4, 7.3): 03:00 de Sao Paulo = 06:00Z', () => {
  it('lastOccurrence: 1 s antes da virada -> 03:00 do dia anterior', () => {
    expect(iso(calc.lastOccurrence(new Date('2026-11-02T05:59:59Z'), at3))).toBe('2026-11-01T06:00:00.000Z');
  });
  it('lastOccurrence: exatamente 06:00:00Z -> o proprio instante (<= now)', () => {
    expect(iso(calc.lastOccurrence(new Date('2026-11-02T06:00:00Z'), at3))).toBe('2026-11-02T06:00:00.000Z');
  });
  it('lastOccurrence: 06:00:01Z -> 06:00Z do mesmo dia', () => {
    expect(iso(calc.lastOccurrence(new Date('2026-11-02T06:00:01Z'), at3))).toBe('2026-11-02T06:00:00.000Z');
  });
  it('nextOccurrence: 05:59:59Z -> 06:00Z do mesmo dia', () => {
    expect(iso(calc.nextOccurrence(new Date('2026-11-02T05:59:59Z'), at3))).toBe('2026-11-02T06:00:00.000Z');
  });
  it('nextOccurrence: exatamente 06:00:00Z -> o do dia seguinte (estritamente > now)', () => {
    expect(iso(calc.nextOccurrence(new Date('2026-11-02T06:00:00Z'), at3))).toBe('2026-11-03T06:00:00.000Z');
  });
  it('nextOccurrence: 06:00:01Z -> o do dia seguinte', () => {
    expect(iso(calc.nextOccurrence(new Date('2026-11-02T06:00:01Z'), at3))).toBe('2026-11-03T06:00:00.000Z');
  });
  it('nao confunde 03:00 UTC com 03:00 de Sao Paulo', () => {
    expect(iso(calc.nextOccurrence(new Date('2026-11-02T02:00:00Z'), at3))).toBe('2026-11-02T06:00:00.000Z');
  });
  it('outro horario: 00:00 de Sao Paulo = 03:00Z', () => {
    const midnight = unwrap<LocalTimeOfDay>(LocalTimeOfDay.parse('00:00'));
    expect(iso(calc.nextOccurrence(new Date('2026-11-02T12:00:00Z'), midnight))).toBe('2026-11-03T03:00:00.000Z');
  });
  it('o intervalo entre execucoes e sempre < 25 h (limite do setTimeout do scheduler)', () => {
    const next = calc.nextOccurrence(new Date('2026-11-02T06:00:00Z'), at3).getTime();
    expect(next - new Date('2026-11-02T06:00:00Z').getTime()).toBeLessThan(25 * 3_600_000);
  });
});

describe.each(['UTC', 'Asia/Tokyo'])('independe do TZ do processo (%s)', (tz) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    process.env.TZ = original;
  });
  it('mesmo resultado nos instantes da virada', () => {
    const c = new SaoPauloDailyTimeCalculator();
    expect(iso(c.lastOccurrence(new Date('2026-11-02T05:59:59Z'), at3))).toBe('2026-11-01T06:00:00.000Z');
    expect(iso(c.lastOccurrence(new Date('2026-11-02T06:00:00Z'), at3))).toBe('2026-11-02T06:00:00.000Z');
    expect(iso(c.nextOccurrence(new Date('2026-11-02T06:00:01Z'), at3))).toBe('2026-11-03T06:00:00.000Z');
  });
});
