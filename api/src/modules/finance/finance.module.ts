import { Module, type Provider } from '@nestjs/common';
import { BUSINESS_CALENDAR, type BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import { CLOCK, type Clock } from '@shared/application/ports/clock.js';
import { DOMAIN_EVENT_PUBLISHER, type DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { ID_GENERATOR, type IdGenerator } from '@shared/application/ports/id-generator.js';
import { CARD_READ_MODEL, type CardReadModel } from './application/ports/card-read-model.js';
import { CATEGORY_READ_MODEL, type CategoryReadModel } from './application/ports/category-read-model.js';
import { DASHBOARD_READ_MODEL, type DashboardReadModel } from './application/ports/dashboard-read-model.js';
import { ENTRY_READ_MODEL, type EntryReadModel } from './application/ports/entry-read-model.js';
import { FINANCE_UNIT_OF_WORK, type FinanceUnitOfWork } from './application/ports/finance-unit-of-work.js';
import { INVOICE_READ_MODEL, type InvoiceReadModel } from './application/ports/invoice-read-model.js';
import { PENDING_OVERVIEW_READ_MODEL, type PendingOverviewReadModel } from './application/ports/pending-overview-read-model.js';
import {
  MONTHLY_SUMMARY_READ_MODEL,
  type MonthlySummaryReadModel,
} from './application/ports/monthly-summary-read-model.js';
import { DEMO_DATASET_STORE, type DemoDatasetStore } from './application/demo/demo-dataset-store.js';
import { RefreshDemoDataset } from './application/demo/refresh-demo-dataset.js';
import { CreateCard } from './application/use-cases/cards/create-card.js';
import { ListCards } from './application/use-cases/cards/list-cards.js';
import { UpdateCard } from './application/use-cases/cards/update-card.js';
import { GetCategoryDistribution } from './application/use-cases/dashboard/get-category-distribution.js';
import { GetMonthlySeries } from './application/use-cases/dashboard/get-monthly-series.js';
import { CreateEntry } from './application/use-cases/entries/create-entry.js';
import { ListCategories } from './application/use-cases/entries/list-categories.js';
import { GetInitialEntriesMonth } from './application/use-cases/entries/get-initial-entries-month.js';
import { ListExpenses } from './application/use-cases/entries/list-expenses.js';
import { ListIncomes } from './application/use-cases/entries/list-incomes.js';
import { MarkEntryAsPaid } from './application/use-cases/entries/mark-entry-as-paid.js';
import { PayEntriesInBatch } from './application/use-cases/entries/pay-entries-in-batch.js';
import { ListInvoiceEntries } from './application/use-cases/invoices/list-invoice-entries.js';
import { ListInvoices } from './application/use-cases/invoices/list-invoices.js';
import { PayInvoice } from './application/use-cases/invoices/pay-invoice.js';
import { GetMonthlySummary } from './application/use-cases/summary/get-monthly-summary.js';
import { CARD_REPOSITORY, type CardRepository } from './domain/card/card.repository.js';
import { CATEGORY_CATALOG, type CategoryCatalog } from './domain/entry/category-catalog.js';
import { ENTRY_REPOSITORY, type EntryRepository } from './domain/entry/entry.repository.js';
import { EntryPaymentService } from './domain/payment/entry-payment.service.js';
import { FINANCE_INFRASTRUCTURE_PROVIDERS } from './infrastructure/finance-infrastructure.providers.js';
import { CardsController } from './presentation/http/cards.controller.js';
import { CategoriesController } from './presentation/http/categories.controller.js';
import { DashboardController } from './presentation/http/dashboard.controller.js';
import { EntriesController } from './presentation/http/entries.controller.js';
import { InvoicesController } from './presentation/http/invoices.controller.js';
import { DemoController } from './presentation/http/demo.controller.js';
import { FinanceReadHandlers } from './presentation/http/finance-read-handlers.js';
import { SummaryController } from './presentation/http/summary.controller.js';

const ENTRY_PAYMENT_SERVICE = Symbol('ENTRY_PAYMENT_SERVICE');

/** Use cases são classes simples: instanciadas por factory com as dependências injetadas por token. */
const USE_CASE_PROVIDERS: Provider[] = [
  {
    provide: RefreshDemoDataset,
    useFactory: (store: DemoDatasetStore, calendar: BusinessCalendar, ids: IdGenerator, clock: Clock) =>
      new RefreshDemoDataset(store, calendar, ids, clock),
    inject: [DEMO_DATASET_STORE, BUSINESS_CALENDAR, ID_GENERATOR, CLOCK],
  },
  { provide: ENTRY_PAYMENT_SERVICE, useFactory: () => new EntryPaymentService() },
  {
    provide: CreateCard,
    useFactory: (cards: CardRepository, ids: IdGenerator, clock: Clock, publisher: DomainEventPublisher) =>
      new CreateCard(cards, ids, clock, publisher),
    inject: [CARD_REPOSITORY, ID_GENERATOR, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: UpdateCard,
    useFactory: (cards: CardRepository, clock: Clock, publisher: DomainEventPublisher) =>
      new UpdateCard(cards, clock, publisher),
    inject: [CARD_REPOSITORY, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  { provide: ListCards, useFactory: (cards: CardReadModel) => new ListCards(cards), inject: [CARD_READ_MODEL] },
  {
    provide: CreateEntry,
    useFactory: (
      entries: EntryRepository,
      cards: CardRepository,
      catalog: CategoryCatalog,
      ids: IdGenerator,
      clock: Clock,
      publisher: DomainEventPublisher,
    ) => new CreateEntry(entries, cards, catalog, ids, clock, publisher),
    inject: [ENTRY_REPOSITORY, CARD_REPOSITORY, CATEGORY_CATALOG, ID_GENERATOR, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: MarkEntryAsPaid,
    useFactory: (uow: FinanceUnitOfWork, entries: EntryReadModel, clock: Clock, publisher: DomainEventPublisher) =>
      new MarkEntryAsPaid(uow, entries, clock, publisher),
    inject: [FINANCE_UNIT_OF_WORK, ENTRY_READ_MODEL, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: PayEntriesInBatch,
    useFactory: (uow: FinanceUnitOfWork, payment: EntryPaymentService, clock: Clock, publisher: DomainEventPublisher) =>
      new PayEntriesInBatch(uow, payment, clock, publisher),
    inject: [FINANCE_UNIT_OF_WORK, ENTRY_PAYMENT_SERVICE, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: PayInvoice,
    useFactory: (uow: FinanceUnitOfWork, payment: EntryPaymentService, clock: Clock, publisher: DomainEventPublisher) =>
      new PayInvoice(uow, payment, clock, publisher),
    inject: [FINANCE_UNIT_OF_WORK, ENTRY_PAYMENT_SERVICE, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: GetMonthlySummary,
    useFactory: (summaries: MonthlySummaryReadModel) => new GetMonthlySummary(summaries),
    inject: [MONTHLY_SUMMARY_READ_MODEL],
  },
  { provide: ListExpenses, useFactory: (entries: EntryReadModel) => new ListExpenses(entries), inject: [ENTRY_READ_MODEL] },
  { provide: ListIncomes, useFactory: (entries: EntryReadModel) => new ListIncomes(entries), inject: [ENTRY_READ_MODEL] },
  {
    provide: GetInitialEntriesMonth,
    useFactory: (overview: PendingOverviewReadModel, calendar: BusinessCalendar) => new GetInitialEntriesMonth(overview, calendar),
    inject: [PENDING_OVERVIEW_READ_MODEL, BUSINESS_CALENDAR],
  },
  {
    provide: ListInvoices,
    useFactory: (invoices: InvoiceReadModel) => new ListInvoices(invoices),
    inject: [INVOICE_READ_MODEL],
  },
  {
    provide: ListInvoiceEntries,
    useFactory: (cards: CardReadModel, invoices: InvoiceReadModel) => new ListInvoiceEntries(cards, invoices),
    inject: [CARD_READ_MODEL, INVOICE_READ_MODEL],
  },
  {
    provide: ListCategories,
    useFactory: (categories: CategoryReadModel) => new ListCategories(categories),
    inject: [CATEGORY_READ_MODEL],
  },
  {
    provide: GetMonthlySeries,
    useFactory: (dashboard: DashboardReadModel) => new GetMonthlySeries(dashboard),
    inject: [DASHBOARD_READ_MODEL],
  },
  {
    provide: GetCategoryDistribution,
    useFactory: (dashboard: DashboardReadModel) => new GetCategoryDistribution(dashboard),
    inject: [DASHBOARD_READ_MODEL],
  },
];

@Module({
  controllers: [
    CardsController,
    InvoicesController,
    EntriesController,
    CategoriesController,
    SummaryController,
    DashboardController,
    DemoController,
  ],
  providers: [...FINANCE_INFRASTRUCTURE_PROVIDERS, ...USE_CASE_PROVIDERS, FinanceReadHandlers],
  exports: [RefreshDemoDataset],
})
export class FinanceModule {}
