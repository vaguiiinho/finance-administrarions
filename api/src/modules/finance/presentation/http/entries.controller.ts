import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { ListExpenses } from '../../application/use-cases/entries/list-expenses.js';
import { ListIncomes } from '../../application/use-cases/entries/list-incomes.js';
import { CreateEntry } from '../../application/use-cases/entries/create-entry.js';
import { MarkEntryAsPaid } from '../../application/use-cases/entries/mark-entry-as-paid.js';
import { PayEntriesInBatch } from '../../application/use-cases/entries/pay-entries-in-batch.js';
import { presentEntry } from './presenters/entry.presenter.js';
import { presentExpenseTotals, presentPagination } from './presenters/totals.presenter.js';
import {
  createEntryBodySchema,
  payBatchBodySchema,
  type CreateEntryBody,
  type PayBatchBody,
} from './schemas/entry.schemas.js';
import {
  expensesQuerySchema,
  incomesQuerySchema,
  type ExpensesQuery,
  type IncomesQuery,
} from './schemas/query.schemas.js';

@Controller('entries')
export class EntriesController {
  constructor(
    @Inject(CreateEntry) private readonly createEntry: CreateEntry,
    @Inject(ListExpenses) private readonly listExpenses: ListExpenses,
    @Inject(ListIncomes) private readonly listIncomes: ListIncomes,
    @Inject(MarkEntryAsPaid) private readonly markEntryAsPaid: MarkEntryAsPaid,
    @Inject(PayEntriesInBatch) private readonly payEntriesInBatch: PayEntriesInBatch,
  ) {}

  @Post()
  async create(@Body(new ZodValidationPipe(createEntryBodySchema)) body: CreateEntryBody) {
    const view = await this.createEntry.execute({ ...body, cardId: body.cardId ?? null, paid: body.paid });
    return presentEntry(view);
  }

  @Get('expenses')
  async expenses(@Query(new ZodValidationPipe(expensesQuerySchema)) query: ExpensesQuery) {
    const result = await this.listExpenses.execute(query);
    return {
      month: result.month.toString(),
      items: result.items.map(presentEntry),
      pagination: presentPagination(result.pagination),
      subtotal: presentExpenseTotals(result.subtotal),
    };
  }

  @Get('incomes')
  async incomes(@Query(new ZodValidationPipe(incomesQuerySchema)) query: IncomesQuery) {
    const result = await this.listIncomes.execute(query);
    return {
      month: result.month.toString(),
      items: result.items.map(presentEntry),
      pagination: presentPagination(result.pagination),
      subtotal: { total: result.subtotal.toString() },
    };
  }

  @Post('pay')
  @HttpCode(200)
  async payBatch(@Body(new ZodValidationPipe(payBatchBodySchema)) body: PayBatchBody) {
    return this.payEntriesInBatch.execute(body);
  }

  @Post(':id/pay')
  @HttpCode(200)
  async pay(@Param('id') id: string) {
    return presentEntry(await this.markEntryAsPaid.execute({ id }));
  }
}
