import type { ClosingDay, DueDay } from '../billing/day-of-month.js';
import type { CardId } from './value-objects/card-id.js';

/** Snapshot imutável dos dados de fatura do cartão, entregue ao Entry na criação. */
export interface CardBillingInfo {
  readonly cardId: CardId;
  readonly closingDay: ClosingDay;
  readonly dueDay: DueDay;
}
