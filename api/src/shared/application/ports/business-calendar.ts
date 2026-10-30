import type { YearMonth } from '../../domain/value-objects/year-month.js';

/** Mês corrente de negócio (America/Sao_Paulo). Usado pela demo (ADR 0005 5.1). */
export interface BusinessCalendar {
  currentMonth(): YearMonth;
}

export const BUSINESS_CALENDAR = Symbol('BUSINESS_CALENDAR');
