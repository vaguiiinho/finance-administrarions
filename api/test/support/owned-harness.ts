import { FixedClock, SequentialIdGenerator, SpyEventPublisher } from '../fakes/simple-fakes.js';
import {
  OwnedCardReadModel,
  OwnedCardRepository,
  OwnedCategoryCatalog,
  OwnedEntryReadModel,
  OwnedEntryRepository,
  OwnedFinanceUnitOfWork,
} from '../fakes/owned-finance-fakes.js';
import { NOW } from './builders.js';
import { CreateCard } from '@finance/application/use-cases/cards/create-card.js';
import { UpdateCard } from '@finance/application/use-cases/cards/update-card.js';
import { ListCards } from '@finance/application/use-cases/cards/list-cards.js';
import { CreateEntry } from '@finance/application/use-cases/entries/create-entry.js';
import { MarkEntryAsPaid } from '@finance/application/use-cases/entries/mark-entry-as-paid.js';
import { PayEntriesInBatch } from '@finance/application/use-cases/entries/pay-entries-in-batch.js';
import { PayInvoice } from '@finance/application/use-cases/invoices/pay-invoice.js';
import { ListInvoiceEntries } from '@finance/application/use-cases/invoices/list-invoice-entries.js';
import { EntryPaymentService } from '@finance/domain/payment/entry-payment.service.js';

/**
 * Composicao dos use cases do finance sobre fakes COM DONO. Mesma ordem de dependencias dos construtores atuais
 * (o ADR 0005 5.5 so muda os INPUTS e as assinaturas dos ports). Ajuste so aqui se diferir.
 */
export function buildOwnedHarness(now: Date = NOW) {
  const clock = new FixedClock(now);
  const ids = new SequentialIdGenerator();
  const publisher = new SpyEventPublisher();
  const cards = new OwnedCardRepository();
  const entries = new OwnedEntryRepository();
  const uow = new OwnedFinanceUnitOfWork(entries, cards);
  const catalog = new OwnedCategoryCatalog(entries);
  const entryReadModel = new OwnedEntryReadModel(entries, cards);
  const cardReadModel = new OwnedCardReadModel(cards);
  const paymentService = new EntryPaymentService();
  return {
    clock,
    ids,
    publisher,
    cards,
    entries,
    uow,
    catalog,
    cardReadModel,
    createCard: new CreateCard(cards, ids, clock, publisher),
    updateCard: new UpdateCard(cards, clock, publisher),
    listCards: new ListCards(cardReadModel),
    createEntry: new CreateEntry(entries, cards, catalog, ids, clock, publisher),
    markEntryAsPaid: new MarkEntryAsPaid(uow as never, entryReadModel, clock, publisher),
    payBatch: new PayEntriesInBatch(uow as never, paymentService, clock, publisher),
    payInvoice: new PayInvoice(uow as never, paymentService, clock, publisher),
    listInvoiceEntries: (invoices: unknown) => new ListInvoiceEntries(cardReadModel, invoices as never),
  };
}

export type OwnedHarness = ReturnType<typeof buildOwnedHarness>;
