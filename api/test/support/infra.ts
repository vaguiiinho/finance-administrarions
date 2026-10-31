import { inject } from 'vitest';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { PrismaCardRepository } from '@finance/infrastructure/repositories/prisma-card.repository.js';
import { PrismaEntryRepository } from '@finance/infrastructure/repositories/prisma-entry.repository.js';
import { PrismaCategoryCatalog } from '@finance/infrastructure/repositories/prisma-category-catalog.js';
import { PrismaFinanceUnitOfWork } from '@finance/infrastructure/prisma-finance-unit-of-work.js';
import { PrismaEntryReadModel } from '@finance/infrastructure/read-models/entry-read-model.prisma.js';
import { PrismaMonthlySummaryReadModel } from '@finance/infrastructure/read-models/monthly-summary-read-model.prisma.js';
import { PrismaInvoiceReadModel } from '@finance/infrastructure/read-models/invoice-read-model.prisma.js';
import { PrismaCardReadModel } from '@finance/infrastructure/read-models/card-read-model.prisma.js';
import { PrismaCategoryReadModel } from '@finance/infrastructure/read-models/category-read-model.prisma.js';
import { PrismaDashboardReadModel } from '@finance/infrastructure/read-models/dashboard-read-model.prisma.js';
import { PrismaPendingOverviewReadModel } from '@finance/infrastructure/read-models/pending-overview-read-model.prisma.js';
import { EntryPaymentService } from '@finance/domain/payment/entry-payment.service.js';
import { CreateCard } from '@finance/application/use-cases/cards/create-card.js';
import { CreateEntry } from '@finance/application/use-cases/entries/create-entry.js';
import { PayEntriesInBatch } from '@finance/application/use-cases/entries/pay-entries-in-batch.js';
import { PayInvoice } from '@finance/application/use-cases/invoices/pay-invoice.js';
import { MarkEntryAsPaid } from '@finance/application/use-cases/entries/mark-entry-as-paid.js';
import { FixedClock, SequentialIdGenerator, SpyEventPublisher } from '../fakes/simple-fakes.js';
import { NOW, asDefaultOwner } from './builders.js';

/**
 * Monta a infraestrutura REAL sobre o Postgres do container. Os use cases saem como o USUARIO PADRAO (`asDefaultOwner`);
 * testes com dois donos passam `ownerId` explicito.
 * CONTRATOS ASSUMIDOS (ajuste so aqui se diferirem):
 *  - `new PrismaService()` le `process.env.DATABASE_URL` e monta o PrismaPg internamente; `$connect()`/`$disconnect()`.
 *  - repositorios/UoW/read models recebem o PrismaService no construtor.
 */
export async function buildInfra(clock: FixedClock = new FixedClock(NOW)) {
  process.env.DATABASE_URL = inject('databaseUrl');
  const prisma = new PrismaService();
  await prisma.$connect();

  const cards = new PrismaCardRepository(prisma);
  const entries = new PrismaEntryRepository(prisma);
  const catalog = new PrismaCategoryCatalog(prisma);
  const uow = new PrismaFinanceUnitOfWork(prisma);
  const ids = new SequentialIdGenerator();
  const publisher = new SpyEventPublisher();
  const paymentService = new EntryPaymentService();

  return {
    prisma,
    clock,
    ids,
    publisher,
    cards,
    entries,
    catalog,
    uow,
    paymentService,
    readModels: {
      entries: new PrismaEntryReadModel(prisma),
      summary: new PrismaMonthlySummaryReadModel(prisma),
      invoices: new PrismaInvoiceReadModel(prisma),
      cards: new PrismaCardReadModel(prisma),
      categories: new PrismaCategoryReadModel(prisma),
      dashboard: new PrismaDashboardReadModel(prisma),
      pendingOverview: new PrismaPendingOverviewReadModel(prisma),
    },
    useCases: {
      createCard: asDefaultOwner(new CreateCard(cards, ids, clock, publisher)),
      createEntry: asDefaultOwner(new CreateEntry(entries, cards, catalog, ids, clock, publisher)),
      markEntryAsPaid: (c: FixedClock = clock) =>
        asDefaultOwner(new MarkEntryAsPaid(uow, new PrismaEntryReadModel(prisma), c, publisher)),
      payBatch: (c: FixedClock = clock, u = uow) => asDefaultOwner(new PayEntriesInBatch(u, paymentService, c, publisher)),
      payInvoice: (c: FixedClock = clock, u = uow) => asDefaultOwner(new PayInvoice(u, paymentService, c, publisher)),
    },
    close: () => prisma.$disconnect(),
  };
}

export type Infra = Awaited<ReturnType<typeof buildInfra>>;
