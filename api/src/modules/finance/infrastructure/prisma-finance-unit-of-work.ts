import type { FinanceTransactionScope, FinanceUnitOfWork } from '../application/ports/finance-unit-of-work.js';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { PrismaCardRepository } from './repositories/prisma-card.repository.js';
import { PrismaEntryRepository } from './repositories/prisma-entry.repository.js';

const TRANSACTION_OPTIONS = { timeout: 10_000, maxWait: 5_000 } as const;

/** Uma transação interativa (READ COMMITTED); exceção -> rollback e relança. */
export class PrismaFinanceUnitOfWork implements FinanceUnitOfWork {
  readonly run: FinanceUnitOfWork['run'];

  constructor(prisma: PrismaService) {
    this.run = <T>(work: (scope: FinanceTransactionScope) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        (tx) => work({ entries: new PrismaEntryRepository(tx), cards: new PrismaCardRepository(tx) }),
        TRANSACTION_OPTIONS,
      );
  }
}
