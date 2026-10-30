import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type { EntryPaymentService } from '../../../domain/payment/entry-payment.service.js';
import { CardNotFoundError } from '../../errors/application-errors.js';
import type { FinanceUnitOfWork } from '../../ports/finance-unit-of-work.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseCardId, parseRequiredMonth, throwIfInvalid } from '../../queries/query-params.js';

export interface PayInvoiceResult {
  cardId: string;
  referenceMonth: string;
  paidIds: string[];
  paidCount: number;
  paidAmount: Money;
}

export class PayInvoice {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly paymentService: EntryPaymentService,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Paga as despesas PENDING do cartão cujo mês de referência (mês do vencimento) é o informado. */
  async execute(input: { ownerId: string; cardId: string; referenceMonth: string }): Promise<PayInvoiceResult> {
    const ownerId = requireOwnerId(input.ownerId);
    const violations: FieldViolation[] = [];
    const cardId = parseCardId(input.cardId, 'cardId', violations);
    const referenceMonth = parseRequiredMonth(input.referenceMonth, 'referenceMonth', violations);
    throwIfInvalid(violations);
    if (!cardId || !referenceMonth) throw new InvariantViolationError('parâmetros validados ausentes.');

    const now = this.clock.now();
    const { paid, events } = await this.uow.run(async ({ entries, cards }) => {
      if (!(await cards.findById(ownerId, cardId))) throw new CardNotFoundError(cardId.value);

      const pending = await entries.findPendingByInvoiceForUpdate(ownerId, { cardId, referenceMonth });
      const outcome = this.paymentService.payAll(pending, now);
      if (outcome.paid.length > 0) await entries.saveAll(outcome.paid);
      return { paid: outcome.paid, events: outcome.paid.flatMap((e) => e.pullEvents()) };
    });

    if (events.length > 0) await this.publisher.publish(events);

    return {
      cardId: cardId.value,
      referenceMonth: referenceMonth.toString(),
      paidIds: paid.map((e) => e.id.value),
      paidCount: paid.length,
      paidAmount: Money.sum(paid.map((e) => e.amount)),
    };
  }
}
