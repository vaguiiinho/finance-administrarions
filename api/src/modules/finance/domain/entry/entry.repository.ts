import type { InvoiceKey } from '../billing/invoice-key.js';
import type { OwnerId } from '../owner/owner-id.js';
import type { Entry } from './entry.js';
import type { EntryId } from './value-objects/entry-id.js';

/** Todo método de leitura recebe o dono como primeiro parâmetro (ADR 0005 4.2). */
export interface EntryRepository {
  /** Persiste também closingDate, dueDate e referenceMonth calculados; status/paidAt iniciais. Dono vem do aggregate. */
  insert(entry: Entry): Promise<void>;
  /** Exige transação (UnitOfWork). Lock exclusivo em ordem de id asc; ids inexistentes ou de outro dono não aparecem. */
  findByIdsForUpdate(ownerId: OwnerId, ids: readonly EntryId[]): Promise<Entry[]>;
  /** Exige transação. Despesas PENDING do cartão com esse mês de referência, travadas em ordem de id asc. */
  findPendingByInvoiceForUpdate(ownerId: OwnerId, key: InvoiceKey): Promise<Entry[]>;
  /** Exige transação e lock obtido por findByIdsForUpdate; persiste os campos editáveis da despesa. */
  update(entry: Entry): Promise<void>;
  /** Exige transação e lock obtido por findByIdsForUpdate; remove somente a despesa do dono. */
  delete(entry: Entry): Promise<void>;
  /** Persiste status, paidAt, updatedAt de despesas existentes (guarda status = PENDING e user_id = entry.ownerId). */
  saveAll(entries: readonly Entry[]): Promise<void>;
  /** Usado só pelo DemoDatasetStore (ADR 0005 5.6). */
  deleteAllOf(ownerId: OwnerId): Promise<void>;
}

export const ENTRY_REPOSITORY = Symbol('ENTRY_REPOSITORY');
