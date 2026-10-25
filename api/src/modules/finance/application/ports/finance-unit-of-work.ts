import type { CardRepository } from '../../domain/card/card.repository.js';
import type { EntryRepository } from '../../domain/entry/entry.repository.js';

export interface FinanceTransactionScope {
  entries: EntryRepository;
  cards: CardRepository;
}

export interface FinanceUnitOfWork {
  /** Uma transação; exceção -> rollback e relança. */
  run<T>(work: (scope: FinanceTransactionScope) => Promise<T>): Promise<T>;
}

export const FINANCE_UNIT_OF_WORK = Symbol('FINANCE_UNIT_OF_WORK');
