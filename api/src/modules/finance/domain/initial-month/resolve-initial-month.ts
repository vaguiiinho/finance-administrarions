import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { ReferenceMonth } from '../billing/reference-month.js';

export type MonthAdvance = 'NONE' | 'NEXT_PENDING' | 'NO_PENDING_AHEAD';

export interface InitialMonthFacts {
  currentMonth: ReferenceMonth;
  /** Menor mês de referência >= currentMonth com pendência; null se não houver. */
  firstPendingMonth: ReferenceMonth | null;
  hasCard: boolean;
}

export interface InitialMonthDecision {
  month: ReferenceMonth;
  advance: MonthAdvance;
}

/** Mês inicial da listagem de lançamentos (ADR 0007 seção 3, RF01). Pura: o "agora" chega como dado. */
export function resolveInitialMonth(facts: InitialMonthFacts): InitialMonthDecision {
  const { currentMonth, firstPendingMonth, hasCard } = facts;
  if (firstPendingMonth === null) {
    return hasCard ? { month: currentMonth.next(), advance: 'NO_PENDING_AHEAD' } : { month: currentMonth, advance: 'NONE' };
  }
  const order = firstPendingMonth.compare(currentMonth);
  if (order < 0) throw new InvariantViolationError('firstPendingMonth anterior ao mês atual: o read model deve filtrar a partir de M.');
  return order === 0 ? { month: currentMonth, advance: 'NONE' } : { month: firstPendingMonth, advance: 'NEXT_PENDING' };
}
