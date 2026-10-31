import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { CurrentOwnerId } from '@shared/presentation/auth/current-principal.decorators.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { CreateEntry } from '../../application/use-cases/entries/create-entry.js';
import { MarkEntryAsPaid } from '../../application/use-cases/entries/mark-entry-as-paid.js';
import { PayEntriesInBatch } from '../../application/use-cases/entries/pay-entries-in-batch.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';
import { presentEntry } from './presenters/entry.presenter.js';
import {
  createEntryBodySchema,
  payBatchBodySchema,
  type CreateEntryBody,
  type PayBatchBody,
} from './schemas/entry.schemas.js';
import {
  expensesQuerySchema,
  incomesQuerySchema,
  noQuerySchema,
  type ExpensesQuery,
  type IncomesQuery,
} from './schemas/query.schemas.js';

@Controller('entries')
export class EntriesController {
  constructor(
    @Inject(CreateEntry) private readonly createEntry: CreateEntry,
    @Inject(MarkEntryAsPaid) private readonly markEntryAsPaid: MarkEntryAsPaid,
    @Inject(PayEntriesInBatch) private readonly payEntriesInBatch: PayEntriesInBatch,
    @Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers,
  ) {}

  @Post()
  async create(@CurrentOwnerId() ownerId: string, @Body(new ZodValidationPipe(createEntryBodySchema)) body: CreateEntryBody) {
    const view = await this.createEntry.execute({ ...body, ownerId, cardId: body.cardId ?? null, paid: body.paid });
    return presentEntry(view);
  }

  // Declarada antes das rotas com parâmetro de caminho; sem query (UNKNOWN_FIELD).
  @Get('initial-month')
  initialMonth(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(noQuerySchema)) _query: object) {
    return this.reads.initialMonth(ownerId);
  }

  @Get('expenses')
  expenses(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(expensesQuerySchema)) query: ExpensesQuery) {
    return this.reads.expenses(ownerId, query);
  }

  @Get('incomes')
  incomes(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(incomesQuerySchema)) query: IncomesQuery) {
    return this.reads.incomes(ownerId, query);
  }

  @Post('pay')
  @HttpCode(200)
  async payBatch(@CurrentOwnerId() ownerId: string, @Body(new ZodValidationPipe(payBatchBodySchema)) body: PayBatchBody) {
    return this.payEntriesInBatch.execute({ ownerId, ...body });
  }

  @Post(':id/pay')
  @HttpCode(200)
  async pay(@CurrentOwnerId() ownerId: string, @Param('id') id: string) {
    return presentEntry(await this.markEntryAsPaid.execute({ ownerId, id }));
  }
}
