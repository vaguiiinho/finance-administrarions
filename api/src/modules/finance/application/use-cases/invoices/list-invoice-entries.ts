import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import { CardNotFoundError } from '../../errors/application-errors.js';
import type { CardReadModel } from '../../ports/card-read-model.js';
import type { InvoiceReadModel } from '../../ports/invoice-read-model.js';
import type { EntryView } from '../../ports/views.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseCardId, parseRequiredMonth, throwIfInvalid } from '../../queries/query-params.js';

export interface ListInvoiceEntriesResult {
  card: { id: string; name: string };
  referenceMonth: ReferenceMonth;
  items: EntryView[];
}

export class ListInvoiceEntries {
  constructor(
    private readonly cards: CardReadModel,
    private readonly invoices: InvoiceReadModel,
  ) {}

  /** Precedência: 400 > 404. Cartão existente sem despesas no mês devolve lista vazia. */
  async execute(input: { ownerId: string; cardId: string; referenceMonth: string }): Promise<ListInvoiceEntriesResult> {
    const ownerId = requireOwnerId(input.ownerId);
    const violations: FieldViolation[] = [];
    const cardId = parseCardId(input.cardId, 'cardId', violations);
    const referenceMonth = parseRequiredMonth(input.referenceMonth, 'referenceMonth', violations);
    throwIfInvalid(violations);
    if (!cardId || !referenceMonth) throw new InvariantViolationError('parâmetros validados ausentes.');

    const card = await this.cards.findById(ownerId, cardId);
    if (!card) throw new CardNotFoundError(cardId.value);

    const items = await this.invoices.listEntries(ownerId, { cardId, referenceMonth });
    return { card: { id: card.id, name: card.name }, referenceMonth, items };
  }
}
