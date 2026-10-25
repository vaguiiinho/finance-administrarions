import type { CardReadModel, CardView } from '@finance/application/ports/card-read-model.js';
import type { EntryReadModel } from '@finance/application/ports/entry-read-model.js';
import type { EntryView } from '@finance/application/ports/views.js';
import type { InMemoryCardRepository, InMemoryEntryRepository } from './in-memory-repositories.js';

/** Read model de lancamento so com `findById` (usado por MarkEntryAsPaid); o resto falha alto. */
export class InMemoryEntryReadModel implements EntryReadModel {
  constructor(
    private readonly entries: InMemoryEntryRepository,
    private readonly cards: InMemoryCardRepository,
  ) {}

  async findById(id: { value: string }): Promise<EntryView | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;
    const s = entry.toSnapshot();
    const card = s.cardId ? this.cards.store.get(s.cardId.value) : undefined;
    return {
      id: s.id.value,
      type: s.type,
      description: s.description.value,
      category: s.category.value,
      date: s.date,
      amount: s.amount,
      paymentMethod: s.paymentMethod,
      card: card ? { id: card.id.value, name: card.name.value } : null,
      invoice: s.invoiceDates
        ? { closingDate: s.invoiceDates.closingDate, dueDate: s.invoiceDates.dueDate }
        : null,
      referenceMonth: s.referenceMonth,
      status: s.status,
      paidAt: s.paidAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    } as EntryView;
  }
  listExpenses(): never {
    throw new Error('nao usado neste teste');
  }
  listIncomes(): never {
    throw new Error('nao usado neste teste');
  }
}

export class InMemoryCardReadModel implements CardReadModel {
  constructor(private readonly cards: InMemoryCardRepository) {}
  private view(id: string): CardView {
    const s = this.cards.store.get(id)!.toSnapshot();
    return {
      id: s.id.value,
      name: s.name.value,
      closingDay: s.closingDay.value,
      dueDay: s.dueDay.value,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
  async listAll(): Promise<CardView[]> {
    return [...this.cards.store.keys()].map((id) => this.view(id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  async findById(id: { value: string }): Promise<CardView | null> {
    return this.cards.store.has(id.value) ? this.view(id.value) : null;
  }
}
