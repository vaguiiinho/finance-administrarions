import type { YearMonth } from '../../domain/value-objects/year-month.js';

/** Mês corrente de negócio (America/Sao_Paulo). Usado pelo mês inicial dos lançamentos e pela âncora do dataset de exemplo (ADR 0013). */
export interface BusinessCalendar {
  currentMonth(): YearMonth;
}

export const BUSINESS_CALENDAR = Symbol('BUSINESS_CALENDAR');
