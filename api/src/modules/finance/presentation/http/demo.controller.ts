import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { Public } from '@shared/presentation/auth/access-metadata.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';
import {
  expensesQuerySchema,
  incomesQuerySchema,
  invoicesQuerySchema,
  monthQuerySchema,
  noQuerySchema,
  type ExpensesQuery,
  type IncomesQuery,
  type InvoicesQuery,
  type MonthQuery,
} from './schemas/query.schemas.js';

/**
 * Leituras públicas e SÓ de leitura sobre os dados do usuário demo (ADR 0005 6.5). Nenhuma rota de escrita existe aqui:
 * qualquer outro método cai em 404 ROUTE_NOT_FOUND. O dono é sempre `DEMO_USER_ID`, nunca o do principal.
 */
@Public()
@Controller('demo')
export class DemoController {
  constructor(@Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers) {}

  @Get('entries/initial-month')
  initialMonth(@Query(new ZodValidationPipe(noQuerySchema)) _query: object) {
    return this.reads.initialMonth(DEMO_USER_ID);
  }

  @Get('entries/expenses')
  expenses(@Query(new ZodValidationPipe(expensesQuerySchema)) query: ExpensesQuery) {
    return this.reads.expenses(DEMO_USER_ID, query);
  }

  @Get('entries/incomes')
  incomes(@Query(new ZodValidationPipe(incomesQuerySchema)) query: IncomesQuery) {
    return this.reads.incomes(DEMO_USER_ID, query);
  }

  @Get('categories')
  categories() {
    return this.reads.categories(DEMO_USER_ID);
  }

  @Get('cards')
  cards() {
    return this.reads.cards(DEMO_USER_ID);
  }

  @Get('invoices')
  invoices(@Query(new ZodValidationPipe(invoicesQuerySchema)) query: InvoicesQuery) {
    return this.reads.invoices(DEMO_USER_ID, query);
  }

  @Get('cards/:cardId/invoices/:referenceMonth/entries')
  invoiceEntries(@Param('cardId') cardId: string, @Param('referenceMonth') referenceMonth: string) {
    return this.reads.invoiceEntries(DEMO_USER_ID, cardId, referenceMonth);
  }

  @Get('summary')
  summary(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    return this.reads.summary(DEMO_USER_ID, query);
  }

  @Get('dashboard/monthly-series')
  monthlySeries(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    return this.reads.monthlySeries(DEMO_USER_ID, query);
  }

  @Get('dashboard/category-distribution')
  categoryDistribution(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    return this.reads.categoryDistribution(DEMO_USER_ID, query);
  }
}
