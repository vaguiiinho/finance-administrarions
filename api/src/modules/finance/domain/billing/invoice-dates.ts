import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { ReferenceMonth } from './reference-month.js';

interface InvoiceDatesProps {
  purchaseDate: CalendarDate;
  closingDate: CalendarDate;
  dueDate: CalendarDate;
}

/** Datas da fatura de uma compra no cartão: fechamento, vencimento e mês de referência (= mês do vencimento). */
export class InvoiceDates {
  private constructor(
    readonly closingDate: CalendarDate,
    readonly dueDate: CalendarDate,
  ) {}

  get referenceMonth(): ReferenceMonth {
    return ReferenceMonth.ofDueDate(this.dueDate);
  }

  /**
   * Reidrata datas gravadas (mapper). Valida só as relações estruturais:
   * purchaseDate <= closingDate < dueDate; fechamento no mês da compra ou no seguinte;
   * vencimento no mês do fechamento ou no seguinte. NÃO recalcula a partir do cartão (DR2).
   */
  static restore({ purchaseDate, closingDate, dueDate }: InvoiceDatesProps): InvoiceDates {
    if (closingDate.compare(purchaseDate) < 0) {
      throw new InvariantViolationError('Fechamento anterior à data da compra.');
    }
    if (dueDate.compare(closingDate) <= 0) {
      throw new InvariantViolationError('Vencimento deve ser posterior ao fechamento.');
    }
    const purchaseMonth = purchaseDate.yearMonth;
    if (!closingDate.yearMonth.equals(purchaseMonth) && !closingDate.yearMonth.equals(purchaseMonth.next())) {
      throw new InvariantViolationError('Fechamento fora do mês da compra ou do seguinte.');
    }
    const closingMonth = closingDate.yearMonth;
    if (!dueDate.yearMonth.equals(closingMonth) && !dueDate.yearMonth.equals(closingMonth.next())) {
      throw new InvariantViolationError('Vencimento fora do mês do fechamento ou do seguinte.');
    }
    return new InvoiceDates(closingDate, dueDate);
  }

  equals(other: InvoiceDates): boolean {
    return this.closingDate.equals(other.closingDate) && this.dueDate.equals(other.dueDate);
  }
}
