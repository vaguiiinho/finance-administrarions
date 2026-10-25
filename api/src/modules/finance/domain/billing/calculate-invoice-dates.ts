import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import type { ClosingDay, DueDay } from './day-of-month.js';
import { InvoiceDates } from './invoice-dates.js';

/**
 * RF05 em duas etapas. Função pura e total (sem relógio, fuso ou I/O).
 * 1. Fechamento: dia efetivo no mês da compra se a compra ocorre até ele; senão no mês seguinte.
 * 2. Vencimento: estritamente após o fechamento (mesmo mês se o dia efetivo for maior; senão mês seguinte).
 * O mês de referência é o mês do vencimento.
 */
export function calculateInvoiceDates(
  purchaseDate: CalendarDate,
  closingDay: ClosingDay,
  dueDay: DueDay,
): InvoiceDates {
  const purchaseMonth = purchaseDate.yearMonth;
  const closingInPurchaseMonth = closingDay.effectiveIn(purchaseMonth);
  const closingDate =
    purchaseDate.day <= closingInPurchaseMonth
      ? CalendarDate.of(purchaseMonth, closingInPurchaseMonth)
      : CalendarDate.of(purchaseMonth.next(), closingDay.effectiveIn(purchaseMonth.next()));

  const closingMonth = closingDate.yearMonth;
  const dueInClosingMonth = dueDay.effectiveIn(closingMonth);
  const dueDate =
    dueInClosingMonth > closingDate.day
      ? CalendarDate.of(closingMonth, dueInClosingMonth)
      : CalendarDate.of(closingMonth.next(), dueDay.effectiveIn(closingMonth.next()));

  return InvoiceDates.restore({ purchaseDate, closingDate, dueDate });
}
