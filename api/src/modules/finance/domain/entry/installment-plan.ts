import type { FieldViolation } from '@shared/domain/app-error.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { Money } from '@shared/domain/value-objects/money.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { ReferenceMonth } from '../billing/reference-month.js';
import { EntryValidationError } from './errors/entry-errors.js';

export interface PlannedInstallment {
  date: CalendarDate;
  amount: Money;
}

const MAX_INSTALLMENTS = 36;

const MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  INVALID_FORMAT: 'Formato inválido.',
  INVALID_DATE: 'Data inexistente no calendário.',
  OUT_OF_RANGE: 'Valor fora da faixa permitida.',
  MUST_BE_POSITIVE: 'O valor deve ser maior que zero.',
  TOO_MANY_DECIMALS: 'Use no máximo 2 casas decimais.',
  TOO_LARGE: 'O valor excede o máximo permitido (9999999999.99).',
  INSTALLMENT_AMOUNT_TOO_SMALL: 'O total deve permitir ao menos R$ 0,01 por parcela.',
};

/** Plano civil e monetário puro: não consulta cartão nem persiste lançamentos. */
export class InstallmentPlan {
  private constructor(readonly items: readonly PlannedInstallment[]) {}

  static create(dateInput: string, totalInput: string, count: number): InstallmentPlan {
    const violations: FieldViolation[] = [];
    const fail = (field: string, code: string) =>
      violations.push({ field, code, message: MESSAGES[code] ?? 'Valor inválido.' });

    const parsedDate = CalendarDate.parse(dateInput);
    if (!parsedDate.ok) fail('date', parsedDate.error);
    else if (parsedDate.value.yearMonth.year < ReferenceMonth.MIN_YEAR || parsedDate.value.yearMonth.year > ReferenceMonth.MAX_YEAR) {
      fail('date', 'OUT_OF_RANGE');
    }

    const parsedTotal = Money.parseEntryAmount(totalInput);
    if (!parsedTotal.ok) fail('amount', parsedTotal.error);
    if (!Number.isInteger(count) || count < 2 || count > MAX_INSTALLMENTS) fail('installments', 'OUT_OF_RANGE');

    if (violations.length > 0 || !parsedDate.ok || !parsedTotal.ok) throw new EntryValidationError(violations);
    if (parsedTotal.value.toCents() < BigInt(count)) fail('amount', 'INSTALLMENT_AMOUNT_TOO_SMALL');

    const firstMonth = parsedDate.value.yearMonth;
    for (let index = 0; index < count; index++) {
      const monthIndex = firstMonth.year * 12 + firstMonth.month - 1 + index;
      const year = Math.floor(monthIndex / 12);
      if (year < ReferenceMonth.MIN_YEAR || year > ReferenceMonth.MAX_YEAR) fail('date', 'OUT_OF_RANGE');
    }
    if (violations.length > 0) throw new EntryValidationError(violations);

    const centsPerInstallment = parsedTotal.value.toCents() / BigInt(count);
    const remainder = parsedTotal.value.toCents() % BigInt(count);
    const items: PlannedInstallment[] = [];
    for (let index = 0; index < count; index++) {
      const monthIndex = firstMonth.year * 12 + firstMonth.month - 1 + index;
      const month = YearMonth.of(Math.floor(monthIndex / 12), (monthIndex % 12) + 1);
      const day = Math.min(parsedDate.value.day, month.lengthInDays());
      const amount = centsPerInstallment + (BigInt(index) < remainder ? 1n : 0n);
      items.push({ date: CalendarDate.of(month, day), amount: Money.fromCents(amount) });
    }
    return new InstallmentPlan(items);
  }
}
