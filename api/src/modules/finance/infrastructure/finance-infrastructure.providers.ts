import type { Provider } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { DEMO_DATASET_STORE } from '../application/demo/demo-dataset-store.js';
import { CARD_READ_MODEL } from '../application/ports/card-read-model.js';
import { CATEGORY_READ_MODEL } from '../application/ports/category-read-model.js';
import { DASHBOARD_READ_MODEL } from '../application/ports/dashboard-read-model.js';
import { ENTRY_READ_MODEL } from '../application/ports/entry-read-model.js';
import { FINANCE_UNIT_OF_WORK } from '../application/ports/finance-unit-of-work.js';
import { INVOICE_READ_MODEL } from '../application/ports/invoice-read-model.js';
import { PENDING_OVERVIEW_READ_MODEL } from '../application/ports/pending-overview-read-model.js';
import { MONTHLY_SUMMARY_READ_MODEL } from '../application/ports/monthly-summary-read-model.js';
import { CARD_REPOSITORY } from '../domain/card/card.repository.js';
import { CATEGORY_CATALOG } from '../domain/entry/category-catalog.js';
import { ENTRY_REPOSITORY } from '../domain/entry/entry.repository.js';
import { SHOWCASE_DATA_PURGER } from '../application/ports/showcase-data-purger.js';
import { PrismaShowcaseDataPurger } from './maintenance/prisma-showcase-data-purger.js';
import { PrismaDemoDatasetStore } from './demo/prisma-demo-dataset-store.js';
import { PrismaFinanceUnitOfWork } from './prisma-finance-unit-of-work.js';
import { PrismaCardReadModel } from './read-models/card-read-model.prisma.js';
import { PrismaCategoryReadModel } from './read-models/category-read-model.prisma.js';
import { PrismaDashboardReadModel } from './read-models/dashboard-read-model.prisma.js';
import { PrismaEntryReadModel } from './read-models/entry-read-model.prisma.js';
import { PrismaInvoiceReadModel } from './read-models/invoice-read-model.prisma.js';
import { PrismaMonthlySummaryReadModel } from './read-models/monthly-summary-read-model.prisma.js';
import { PrismaPendingOverviewReadModel } from './read-models/pending-overview-read-model.prisma.js';
import { PrismaCardRepository } from './repositories/prisma-card.repository.js';
import { PrismaCategoryCatalog } from './repositories/prisma-category-catalog.js';
import { PrismaEntryRepository } from './repositories/prisma-entry.repository.js';

const fromPrisma = <T>(token: symbol, create: (prisma: PrismaService) => T): Provider => ({
  provide: token,
  useFactory: create,
  inject: [PrismaService],
});

/** Token -> implementação Prisma (único lugar que liga ports às implementações). */
export const FINANCE_INFRASTRUCTURE_PROVIDERS: Provider[] = [
  fromPrisma(CARD_REPOSITORY, (prisma) => new PrismaCardRepository(prisma)),
  fromPrisma(ENTRY_REPOSITORY, (prisma) => new PrismaEntryRepository(prisma)),
  fromPrisma(CATEGORY_CATALOG, (prisma) => new PrismaCategoryCatalog(prisma)),
  fromPrisma(FINANCE_UNIT_OF_WORK, (prisma) => new PrismaFinanceUnitOfWork(prisma)),
  fromPrisma(ENTRY_READ_MODEL, (prisma) => new PrismaEntryReadModel(prisma)),
  fromPrisma(MONTHLY_SUMMARY_READ_MODEL, (prisma) => new PrismaMonthlySummaryReadModel(prisma)),
  fromPrisma(INVOICE_READ_MODEL, (prisma) => new PrismaInvoiceReadModel(prisma)),
  fromPrisma(CARD_READ_MODEL, (prisma) => new PrismaCardReadModel(prisma)),
  fromPrisma(CATEGORY_READ_MODEL, (prisma) => new PrismaCategoryReadModel(prisma)),
  fromPrisma(DASHBOARD_READ_MODEL, (prisma) => new PrismaDashboardReadModel(prisma)),
  fromPrisma(PENDING_OVERVIEW_READ_MODEL, (prisma) => new PrismaPendingOverviewReadModel(prisma)),
  fromPrisma(SHOWCASE_DATA_PURGER, (prisma) => new PrismaShowcaseDataPurger(prisma)),
  fromPrisma(DEMO_DATASET_STORE, (prisma) => new PrismaDemoDatasetStore(prisma)),
];
