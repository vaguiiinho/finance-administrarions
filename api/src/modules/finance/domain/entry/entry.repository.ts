import type { InvoiceKey } from '../billing/invoice-key.js';
import type { Entry } from './entry.js';
import type { EntryId } from './value-objects/entry-id.js';

export interface EntryRepository {
  /** Persiste também closingDate, dueDate e referenceMonth calculados; status/paidAt iniciais. */
  insert(entry: Entry): Promise<void>;
  /** Exige transação (UnitOfWork). Lock exclusivo em ordem de id asc; ids inexistentes não aparecem. */
  findByIdsForUpdate(ids: readonly EntryId[]): Promise<Entry[]>;
  /** Exige transação. Despesas PENDING do cartão com esse mês de referência, travadas em ordem de id asc. */
  findPendingByInvoiceForUpdate(key: InvoiceKey): Promise<Entry[]>;
  /** Persiste status, paidAt, updatedAt de despesas existentes (guarda status = PENDING). */
  saveAll(entries: readonly Entry[]): Promise<void>;
}

export const ENTRY_REPOSITORY = Symbol('ENTRY_REPOSITORY');
