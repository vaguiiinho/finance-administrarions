import type { CardRepository } from '@finance/domain/card/card.repository.js';
import type { EntryRepository } from '@finance/domain/entry/entry.repository.js';
import type { CategoryCatalog } from '@finance/domain/entry/category-catalog.js';
import type { FinanceTransactionScope, FinanceUnitOfWork } from '@finance/application/ports/finance-unit-of-work.js';
import { Card } from '@finance/domain/card/card.js';
import { Entry } from '@finance/domain/entry/entry.js';
import { Category } from '@finance/domain/entry/value-objects/category.js';
import type { OwnerId } from '@finance/domain/owner/owner-id.js';
import { unwrap } from '../support/result.js';

/** Copia por snapshot: o "banco" nunca compartilha instancia com o use case (mutacao sem save nao persiste). */
const copyCard = (c: Card) => Card.restore(c.toSnapshot());
const copyEntry = (e: Entry) => Entry.restore(e.toSnapshot());

export class InMemoryCardRepository implements CardRepository {
  store = new Map<string, Card>();
  calls = { insert: 0, update: 0, findById: 0, findByNameKey: 0 };

  async insert(card: Card): Promise<void> {
    this.calls.insert++;
    this.store.set(card.id.value, copyCard(card));
  }
  async update(card: Card): Promise<void> {
    this.calls.update++;
    this.store.set(card.id.value, copyCard(card));
  }
  async findById(ownerId: OwnerId, id: { value: string }): Promise<Card | null> {
    this.calls.findById++;
    const found = this.store.get(id.value);
    return found && found.ownerId.equals(ownerId) ? copyCard(found) : null;
  }
  async findByNameKey(ownerId: OwnerId, key: string): Promise<Card | null> {
    this.calls.findByNameKey++;
    for (const card of this.store.values()) if (card.ownerId.equals(ownerId) && card.name.key === key) return copyCard(card);
    return null;
  }
  seed(card: Card): void {
    this.store.set(card.id.value, copyCard(card));
  }
  all(): Card[] {
    return [...this.store.values()].map(copyCard);
  }
  snapshotState() {
    return new Map([...this.store].map(([k, v]) => [k, copyCard(v)]));
  }
  restoreState(state: Map<string, Card>) {
    this.store = state;
  }
}

export class InMemoryEntryRepository implements EntryRepository {
  store = new Map<string, Entry>();
  calls = { insert: 0, findByIdsForUpdate: 0, findPendingByInvoiceForUpdate: 0, update: 0, delete: 0, saveAll: 0 };
  /** Simula falha no meio da gravacao: grava `failAfter` entradas e lanca (CA34, CA42). */
  failAfter: number | null = null;
  /** Quando true, `findByIdsForUpdate`/`findPending...` exigem estar dentro de uow.run (contrato "exige transacao"). */
  requireTransaction = false;
  inTransaction = false;

  async insert(entry: Entry): Promise<void> {
    this.calls.insert++;
    this.store.set(entry.id.value, copyEntry(entry));
  }
  async findByIdsForUpdate(ownerId: OwnerId, ids: readonly { value: string }[]): Promise<Entry[]> {
    this.calls.findByIdsForUpdate++;
    this.assertTx();
    return [...new Set(ids.map((i) => i.value))]
      .sort()
      .filter((id) => this.store.has(id) && this.store.get(id)!.ownerId.equals(ownerId))
      .map((id) => copyEntry(this.store.get(id)!));
  }
  async findPendingByInvoiceForUpdate(
    ownerId: OwnerId,
    key: { cardId: { value: string }; referenceMonth: { toString(): string } },
  ): Promise<Entry[]> {
    this.calls.findPendingByInvoiceForUpdate++;
    this.assertTx();
    return [...this.store.values()]
      .filter((e) => {
        const s = e.toSnapshot();
        return (
          e.ownerId.equals(ownerId) &&
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
    this.calls.saveAll++;
    let written = 0;
    for (const entry of entries) {
      if (this.failAfter !== null && written >= this.failAfter) {
        throw new Error('falha simulada durante a gravacao');
      }
      this.store.set(entry.id.value, copyEntry(entry));
      written++;
    }
  }
  async update(entry: Entry): Promise<void> {
    this.calls.update++;
    this.assertTx();
    this.store.set(entry.id.value, copyEntry(entry));
  }
  async delete(entry: Entry): Promise<void> {
    this.calls.delete++;
    this.assertTx();
    const snapshot = entry.toSnapshot();
    const existing = this.store.get(snapshot.id.value);
    if (!existing || !existing.ownerId.equals(snapshot.ownerId) || existing.type !== 'EXPENSE') {
      throw new Error('delete: lançamento não encontrado ou não é despesa.');
    }
    this.store.delete(snapshot.id.value);
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
    if (this.requireTransaction && !this.inTransaction) {
      throw new Error('operacao exige transacao (UnitOfWork.run)');
    }
  }
}

/** UnitOfWork em memoria: snapshot antes, rollback se `work` lancar, relanca o erro. */
export class InMemoryFinanceUnitOfWork implements FinanceUnitOfWork {
  runs = 0;
  rollbacks = 0;
  constructor(
    private readonly entries: InMemoryEntryRepository,
    private readonly cards: InMemoryCardRepository,
  ) {
    this.entries.requireTransaction = true;
  }
  async run<T>(work: (scope: FinanceTransactionScope) => Promise<T>): Promise<T> {
    this.runs++;
    const entriesState = this.entries.snapshotState();
    const cardsState = this.cards.snapshotState();
    this.entries.inTransaction = true;
    try {
      return await work({ entries: this.entries, cards: this.cards });
    } catch (error) {
      this.rollbacks++;
      this.entries.restoreState(entriesState);
      this.cards.restoreState(cardsState);
      throw error;
    } finally {
      this.entries.inTransaction = false;
    }
  }
}

/** Catalogo de categorias: grafia do primeiro uso (por createdAt), considerando receitas e despesas (P23). */
export class InMemoryCategoryCatalog implements CategoryCatalog {
  calls = 0;
  constructor(private readonly entries: InMemoryEntryRepository) {}
  async findByKey(ownerId: OwnerId, key: string): Promise<Category | null> {
    this.calls++;
    const matches = this.entries
      .all()
      .filter((e) => e.ownerId.equals(ownerId))
      .map((e) => e.toSnapshot())
      .filter((s) => s.category.key === key)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return matches.length ? unwrap<Category>(Category.create(matches[0].category.value)) : null;
  }
}
