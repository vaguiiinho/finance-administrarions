import type { CardRepository } from '@finance/domain/card/card.repository.js';
import type { EntryRepository } from '@finance/domain/entry/entry.repository.js';
import type { CategoryCatalog } from '@finance/domain/entry/category-catalog.js';
import { Card } from '@finance/domain/card/card.js';
import { Entry } from '@finance/domain/entry/entry.js';
import { Category } from '@finance/domain/entry/value-objects/category.js';
import type { CardReadModel, CardView } from '@finance/application/ports/card-read-model.js';
import type { EntryReadModel } from '@finance/application/ports/entry-read-model.js';
import type { EntryView } from '@finance/application/ports/views.js';
import { unwrap } from '../support/result.js';

/**
 * Fakes que implementam os contratos NOVOS (ADR 0005 4.2): `ownerId` como primeiro parametro.
 * Se um use case chamar o repositorio sem dono, o fake falha ALTO (erro de contrato), nunca devolve dados de todos.
 */
const need = (who: unknown): string => {
  const value = (who as { value?: unknown } | null)?.value;
  if (typeof value !== 'string') {
    throw new Error('CONTRATO: o repositorio/read model exige ownerId (OwnerId) como primeiro argumento');
  }
  return value;
};
const ownerOfAggregate = (aggregate: { ownerId?: { value?: unknown } }): string => {
  const value = aggregate.ownerId?.value;
  if (typeof value !== 'string') throw new Error('CONTRATO: o aggregate precisa expor ownerId (OwnerId)');
  return value;
};

const copyCard = (c: Card) => Card.restore(c.toSnapshot());
const copyEntry = (e: Entry) => Entry.restore(e.toSnapshot());

export class OwnedCardRepository implements CardRepository {
  store = new Map<string, Card>();
  async insert(card: Card): Promise<void> {
    ownerOfAggregate(card as never);
    this.store.set(card.id.value, copyCard(card));
  }
  async update(card: Card): Promise<void> {
    ownerOfAggregate(card as never);
    this.store.set(card.id.value, copyCard(card));
  }
  async findById(ownerId: never, id: { value: string }): Promise<Card | null> {
    const who = need(ownerId);
    const found = this.store.get(id.value);
    return found && ownerOfAggregate(found as never) === who ? copyCard(found) : null;
  }
  async findByNameKey(ownerId: never, key: string): Promise<Card | null> {
    const who = need(ownerId);
    for (const card of this.store.values()) {
      if (ownerOfAggregate(card as never) === who && card.name.key === key) return copyCard(card);
    }
    return null;
  }
  seed(card: Card): void {
    this.store.set(card.id.value, copyCard(card));
  }
  get(id: { value: string }): Card | undefined {
    const found = this.store.get(id.value);
    return found ? copyCard(found) : undefined;
  }
  snapshotState() {
    return new Map([...this.store].map(([k, v]) => [k, copyCard(v)]));
  }
  restoreState(state: Map<string, Card>) {
    this.store = state;
  }
}

export class OwnedEntryRepository implements EntryRepository {
  store = new Map<string, Entry>();
  inTransaction = false;
  async insert(entry: Entry): Promise<void> {
    ownerOfAggregate(entry as never);
    this.store.set(entry.id.value, copyEntry(entry));
  }
  async findByIdsForUpdate(ownerId: never, ids: readonly { value: string }[]): Promise<Entry[]> {
    const who = need(ownerId);
    this.assertTx();
    return [...new Set(ids.map((i) => i.value))]
      .sort()
      .map((id) => this.store.get(id))
      .filter((e): e is Entry => !!e && ownerOfAggregate(e as never) === who)
      .map(copyEntry);
  }
  async findPendingByInvoiceForUpdate(
    ownerId: never,
    key: { cardId: { value: string }; referenceMonth: { toString(): string } },
  ): Promise<Entry[]> {
    const who = need(ownerId);
    this.assertTx();
    return [...this.store.values()]
      .filter((e) => {
        const s = e.toSnapshot();
        return (
          ownerOfAggregate(e as never) === who &&
          s.type === 'EXPENSE' &&
          s.status === 'PENDING' &&
          s.cardId?.value === key.cardId.value &&
          s.referenceMonth.toString() === key.referenceMonth.toString()
        );
      })
      .sort((a, b) => (a.id.value < b.id.value ? -1 : 1))
      .map(copyEntry);
  }
  async saveAll(entries: readonly Entry[]): Promise<void> {
    for (const entry of entries) {
      ownerOfAggregate(entry as never);
      this.store.set(entry.id.value, copyEntry(entry));
    }
  }
  async delete(entry: Entry): Promise<void> {
    this.assertTx();
    const who = ownerOfAggregate(entry as never);
    const existing = this.store.get(entry.id.value);
    if (!existing || ownerOfAggregate(existing as never) !== who || existing.type !== 'EXPENSE') {
      throw new Error('delete: lançamento não encontrado ou não é despesa.');
    }
    this.store.delete(entry.id.value);
  }
  async deleteAllOf(ownerId: never): Promise<void> {
    const who = need(ownerId);
    for (const [id, e] of [...this.store]) if (ownerOfAggregate(e as never) === who) this.store.delete(id);
  }
  seed(entry: Entry): void {
    this.store.set(entry.id.value, copyEntry(entry));
  }
  get(id: { value: string }): Entry | undefined {
    const found = this.store.get(id.value);
    return found ? copyEntry(found) : undefined;
  }
  all(): Entry[] {
    return [...this.store.values()].map(copyEntry);
  }
  snapshotState() {
    return new Map([...this.store].map(([k, v]) => [k, copyEntry(v)]));
  }
  restoreState(state: Map<string, Entry>) {
    this.store = state;
  }
  private assertTx() {
    if (!this.inTransaction) throw new Error('operacao exige transacao (UnitOfWork.run)');
  }
}

export class OwnedFinanceUnitOfWork {
  constructor(
    private readonly entries: OwnedEntryRepository,
    private readonly cards: OwnedCardRepository,
  ) {}
  async run<T>(work: (scope: { entries: OwnedEntryRepository; cards: OwnedCardRepository }) => Promise<T>): Promise<T> {
    const entriesState = this.entries.snapshotState();
    const cardsState = this.cards.snapshotState();
    this.entries.inTransaction = true;
    try {
      return await work({ entries: this.entries, cards: this.cards });
    } catch (error) {
      this.entries.restoreState(entriesState);
      this.cards.restoreState(cardsState);
      throw error;
    } finally {
      this.entries.inTransaction = false;
    }
  }
}

/** Grafia canonica do primeiro uso DESTE dono. */
export class OwnedCategoryCatalog implements CategoryCatalog {
  constructor(private readonly entries: OwnedEntryRepository) {}
  async findByKey(ownerId: never, key: string): Promise<Category | null> {
    const who = need(ownerId);
    const matches = this.entries
      .all()
      .filter((e) => ownerOfAggregate(e as never) === who)
      .map((e) => e.toSnapshot())
      .filter((s) => s.category.key === key)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return matches.length ? unwrap<Category>(Category.create(matches[0].category.value)) : null;
  }
}

export class OwnedEntryReadModel implements EntryReadModel {
  constructor(
    private readonly entries: OwnedEntryRepository,
    private readonly cards: OwnedCardRepository,
  ) {}
  async findById(ownerId: never, id: { value: string }): Promise<EntryView | null> {
    const who = need(ownerId);
    const entry = this.entries.get(id);
    if (!entry || ownerOfAggregate(entry as never) !== who) return null;
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
      invoice: s.invoiceDates ? { closingDate: s.invoiceDates.closingDate, dueDate: s.invoiceDates.dueDate } : null,
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

export class OwnedCardReadModel implements CardReadModel {
  constructor(private readonly cards: OwnedCardRepository) {}
  private view(card: Card): CardView {
    const s = card.toSnapshot();
    return {
      id: s.id.value,
      name: s.name.value,
      closingDay: s.closingDay.value,
      dueDay: s.dueDay.value,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
  async listAll(ownerId: never): Promise<CardView[]> {
    const who = need(ownerId);
    return [...this.cards.store.values()]
      .filter((c) => ownerOfAggregate(c as never) === who)
      .map((c) => this.view(c))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  async findById(ownerId: never, id: { value: string }): Promise<CardView | null> {
    const who = need(ownerId);
    const card = this.cards.store.get(id.value);
    return card && ownerOfAggregate(card as never) === who ? this.view(card) : null;
  }
}
