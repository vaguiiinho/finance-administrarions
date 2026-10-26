import { unwrap } from '@test/support/result.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { InvoiceDates } from './invoice-dates.js';

const d = (v: string) => unwrap<CalendarDate>(CalendarDate.parse(v));
const restore = (purchase: string, closing: string, due: string) =>
  InvoiceDates.restore({ purchaseDate: d(purchase), closingDate: d(closing), dueDate: d(due) });

describe('InvoiceDates.restore (reidrata datas gravadas sem recalcular)', () => {
  it('aceita datas coerentes e deriva o mes de referencia do vencimento', () => {
    const dates = restore('2026-10-10', '2026-10-25', '2026-11-05');
    expect(dates.closingDate.toString()).toBe('2026-10-25');
    expect(dates.dueDate.toString()).toBe('2026-11-05');
    expect(dates.referenceMonth.toString()).toBe('2026-11');
  });

  it('aceita fechamento no proprio dia da compra', () => {
    expect(restore('2026-10-25', '2026-10-25', '2026-11-05').referenceMonth.toString()).toBe('2026-11');
  });

  it('aceita datas que o cartao atual nao produziria (nao recalcula, DR2)', () => {
    // fecha 10/vence 17 gravados, mesmo que o cartao hoje seja outro
    const dates = restore('2026-10-15', '2026-11-10', '2026-11-17');
    expect(dates.referenceMonth.toString()).toBe('2026-11');
  });

  it('aceita virada de ano', () => {
    expect(restore('2026-12-26', '2027-01-25', '2027-02-05').referenceMonth.toString()).toBe('2027-02');
  });

  it.each([
    ['fechamento anterior a compra', '2026-10-10', '2026-10-09', '2026-11-05'],
    ['vencimento igual ao fechamento', '2026-10-10', '2026-10-25', '2026-10-25'],
    ['vencimento anterior ao fechamento', '2026-10-10', '2026-10-25', '2026-10-24'],
    ['fechamento dois meses depois da compra', '2026-10-10', '2026-12-01', '2026-12-10'],
    ['vencimento dois meses depois do fechamento', '2026-10-10', '2026-10-25', '2026-12-05'],
  ])('rejeita %s com InvariantViolationError', (_label, purchase, closing, due) => {
    let error: unknown;
    try {
      restore(purchase, closing, due);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).constructor.name).toBe('InvariantViolationError');
  });

  it('equals compara as tres datas', () => {
    expect(restore('2026-10-10', '2026-10-25', '2026-11-05').equals(restore('2026-10-12', '2026-10-25', '2026-11-05'))).toBe(true);
    expect(restore('2026-10-10', '2026-10-25', '2026-11-05').equals(restore('2026-10-10', '2026-10-25', '2026-11-06'))).toBe(false);
  });
});
