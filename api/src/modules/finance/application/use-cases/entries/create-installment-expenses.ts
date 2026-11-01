import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { Card } from '../../../domain/card/card.js';
import type { CardRepository } from '../../../domain/card/card.repository.js';
import type { CategoryCatalog } from '../../../domain/entry/category-catalog.js';
import { Entry } from '../../../domain/entry/entry.js';
import type { EntryDomainEvent } from '../../../domain/entry/events/entry-events.js';
import { InstallmentPlan } from '../../../domain/entry/installment-plan.js';
import { NewEntryInput } from '../../../domain/entry/new-entry-input.js';
import { EntryId } from '../../../domain/entry/value-objects/entry-id.js';
import { CardNotFoundError } from '../../errors/application-errors.js';
import type { FinanceUnitOfWork } from '../../ports/finance-unit-of-work.js';
import type { EntryView } from '../../ports/views.js';
import { requireOwnerId } from '../../queries/owner.js';
import { toEntryView } from '../../mappers/view.mapper.js';

export interface CreateInstallmentExpensesInput {
  ownerId: string;
  description: string;
  category: string;
  date: string;
  amount: string;
  installments: number;
  paymentMethod: string;
  cardId?: string | null;
}

export class CreateInstallmentExpenses {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly cards: CardRepository,
    private readonly catalog: CategoryCatalog,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(raw: CreateInstallmentExpensesInput): Promise<EntryView[]> {
    const ownerId = requireOwnerId(raw.ownerId);
    const plan = InstallmentPlan.create(raw.date, raw.amount, raw.installments);
    let card: Card | null = null;
    if (raw.paymentMethod === 'CARD') {
      const firstInput = NewEntryInput.parse({
        type: 'EXPENSE',
        description: raw.description,
        category: raw.category,
        date: plan.items[0].date.toString(),
        amount: plan.items[0].amount.toString(),
        paymentMethod: raw.paymentMethod,
        cardId: raw.cardId ?? null,
        paid: false,
      });
      const cardId = firstInput.cardId;
      if (!cardId) throw new InvariantViolationError('A entrada de cartão validada precisa conter um cartão.');
      card = await this.cards.findById(ownerId, cardId);
      if (!card) throw new CardNotFoundError(cardId.value);
    }

    const first = NewEntryInput.parse({
      type: 'EXPENSE',
      description: raw.description,
      category: raw.category,
      date: plan.items[0].date.toString(),
      amount: plan.items[0].amount.toString(),
      paymentMethod: raw.paymentMethod,
      cardId: raw.cardId ?? null,
      paid: false,
    });
    const canonical = await this.catalog.findByKey(ownerId, first.category.key);
    const views: EntryView[] = [];
    const events = await this.uow.run(async ({ entries }) => {
      const pendingEvents: EntryDomainEvent[] = [];
      for (const installment of plan.items) {
        const input = NewEntryInput.parse({
          type: 'EXPENSE',
          description: raw.description,
          category: canonical?.value ?? first.category.value,
          date: installment.date.toString(),
          amount: installment.amount.toString(),
          paymentMethod: raw.paymentMethod,
          cardId: raw.cardId ?? null,
          paid: false,
        });
        const id = EntryId.create(this.ids.next());
        if (!id.ok) throw new InvariantViolationError('IdGenerator devolveu um UUID inválido.');
        const entry = Entry.create({
          id: id.value,
          ownerId,
          input,
          card: card?.billingInfo() ?? null,
          now: this.clock.now(),
        });
        await entries.insert(entry);
        pendingEvents.push(...entry.pullEvents());
        views.push(toEntryView(entry, card ? { id: card.id.value, name: card.name.value } : null));
      }
      return pendingEvents;
    });
    if (events.length > 0) await this.publisher.publish(events);
    return views;
  }
}
