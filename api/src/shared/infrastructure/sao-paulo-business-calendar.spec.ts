import { FixedClock } from '@test/fakes/simple-fakes.js';
import { SaoPauloBusinessCalendar } from './sao-paulo-business-calendar.js';

// Caracterizacao do mes de negocio nas fronteiras de fuso (ADR 0007 secao 10, CA18-CA20 / RNF03). O comportamento ja existe
// (ADR 0005 5.1); estes testes o travam antes da feature passar a depender dele.
const month = (iso: string) => new SaoPauloBusinessCalendar(new FixedClock(new Date(iso))).currentMonth().toString();

describe('SaoPauloBusinessCalendar.currentMonth - fronteiras de mes em America/Sao_Paulo', () => {
  it.each([
    ['CA18: ultimo minuto de outubro em SP (31/10 23:30)', '2026-11-01T02:30:00.000Z', '2026-10'],
    ['CA19: primeiro minuto de novembro em SP (01/11 00:30)', '2026-11-01T03:30:00.000Z', '2026-11'],
    ['CA20: ultimo minuto do ano em SP (31/12 23:30)', '2027-01-01T02:30:00.000Z', '2026-12'],
    ['primeiro minuto do ano em SP (01/01 00:30)', '2027-01-01T03:30:00.000Z', '2027-01'],
    ['um instante antes da meia-noite UTC do dia 1 ainda e o mes anterior em SP', '2026-12-01T02:59:59.999Z', '2026-11'],
    ['exatamente a meia-noite de SP vira o mes', '2026-12-01T03:00:00.000Z', '2026-12'],
  ])('%s', (_name, iso, expected) => {
    expect(month(iso)).toBe(expected);
  });

  it('nao depende do fuso do processo (usa America/Sao_Paulo mesmo com TZ diferente)', () => {
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(month('2026-11-01T02:30:00.000Z')).toBe('2026-10');
    } finally {
      process.env.TZ = original;
    }
  });
});
