import { FixedClock, SequentialIdGenerator, SpyEventPublisher } from '../fakes/simple-fakes.js';
import {
  InMemoryCardRepository,
  InMemoryCategoryCatalog,
  InMemoryEntryRepository,
  InMemoryFinanceUnitOfWork,
} from '../fakes/in-memory-repositories.js';
import { InMemoryCardReadModel, InMemoryEntryReadModel } from '../fakes/in-memory-read-models.js';
import { NOW, asDefaultOwner } from './builders.js';
import { CreateCard } from '@finance/application/use-cases/cards/create-card.js';
import { UpdateCard } from '@finance/application/use-cases/cards/update-card.js';
import { CreateEntry } from '@finance/application/use-cases/entries/create-entry.js';
import { UpdateExpense } from '@finance/application/use-cases/entries/update-expense.js';
import { MarkEntryAsPaid } from '@finance/application/use-cases/entries/mark-entry-as-paid.js';
import { PayEntriesInBatch } from '@finance/application/use-cases/entries/pay-entries-in-batch.js';
import { PayInvoice } from '@finance/application/use-cases/invoices/pay-invoice.js';
import { EntryPaymentService } from '@finance/domain/payment/entry-payment.service.js';

/**
 * Composicao dos use cases de escrita com fakes em memoria, como o USUARIO PADRAO (`asDefaultOwner`): estes testes
 * cobrem as regras de um usuario so; o isolamento entre donos esta em owner-isolation.spec.ts (owned-harness).
 * CONTRATO ASSUMIDO: construtores posicionais na ordem da tabela 5.2 do ADR
 * (dependencias na ordem listada) e metodo `execute(input)`. Se a ordem diferir,
 * ajuste APENAS este arquivo.
 */
export function buildHarness(now: Date = NOW) {
  const clock = new FixedClock(now);
  const ids = new SequentialIdGenerator();
  const publisher = new SpyEventPublisher();
  const cards = new InMemoryCardRepository();
  const entries = new InMemoryEntryRepository();
  const uow = new InMemoryFinanceUnitOfWork(entries, cards);
  const catalog = new InMemoryCategoryCatalog(entries);
  const entryReadModel = new InMemoryEntryReadModel(entries, cards);
  const cardReadModel = new InMemoryCardReadModel(cards);
  const paymentService = new EntryPaymentService();

  return {
    clock,
    ids,
    publisher,
    cards,
    entries,
    uow,
    catalog,
    entryReadModel,
    cardReadModel,
    createCard: asDefaultOwner(new CreateCard(cards, ids, clock, publisher)),
    updateCard: asDefaultOwner(new UpdateCard(cards, clock, publisher)),
    createEntry: asDefaultOwner(new CreateEntry(entries, cards, catalog, ids, clock, publisher)),
    updateExpense: asDefaultOwner(new UpdateExpense(uow, catalog, entryReadModel, clock, publisher)),
    markEntryAsPaid: asDefaultOwner(new MarkEntryAsPaid(uow, entryReadModel, clock, publisher)),
    payBatch: asDefaultOwner(new PayEntriesInBatch(uow, paymentService, clock, publisher)),
    payInvoice: asDefaultOwner(new PayInvoice(uow, paymentService, clock, publisher)),
  };
}

export type Harness = ReturnType<typeof buildHarness>;
