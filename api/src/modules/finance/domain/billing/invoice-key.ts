import type { CardId } from '../card/value-objects/card-id.js';
import type { ReferenceMonth } from './reference-month.js';

/** Critério de seleção de uma fatura: cartão + mês de referência (a fatura não é aggregate). */
export interface InvoiceKey {
  readonly cardId: CardId;
  readonly referenceMonth: ReferenceMonth;
}
