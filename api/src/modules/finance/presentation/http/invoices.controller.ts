import { Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { CurrentOwnerId } from '@shared/presentation/auth/current-principal.decorators.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { PayInvoice } from '../../application/use-cases/invoices/pay-invoice.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';
import { invoicesQuerySchema, type InvoicesQuery } from './schemas/query.schemas.js';

@Controller()
export class InvoicesController {
  constructor(
    @Inject(PayInvoice) private readonly payInvoice: PayInvoice,
    @Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers,
  ) {}

  @Get('invoices')
  list(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(invoicesQuerySchema)) query: InvoicesQuery) {
    return this.reads.invoices(ownerId, query);
  }

  @Get('cards/:cardId/invoices/:referenceMonth/entries')
  entries(
    @CurrentOwnerId() ownerId: string,
    @Param('cardId') cardId: string,
    @Param('referenceMonth') referenceMonth: string,
  ) {
    return this.reads.invoiceEntries(ownerId, cardId, referenceMonth);
  }

  @Post('cards/:cardId/invoices/:referenceMonth/pay')
  @HttpCode(200)
  async pay(
    @CurrentOwnerId() ownerId: string,
    @Param('cardId') cardId: string,
    @Param('referenceMonth') referenceMonth: string,
  ) {
    const result = await this.payInvoice.execute({ ownerId, cardId, referenceMonth });
    return { ...result, paidAmount: result.paidAmount.toString() };
  }
}
