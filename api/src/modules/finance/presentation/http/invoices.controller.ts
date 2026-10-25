import { Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { ListInvoiceEntries } from '../../application/use-cases/invoices/list-invoice-entries.js';
import { ListInvoices } from '../../application/use-cases/invoices/list-invoices.js';
import { PayInvoice } from '../../application/use-cases/invoices/pay-invoice.js';
import { presentEntry } from './presenters/entry.presenter.js';
import { presentExpenseTotals } from './presenters/totals.presenter.js';
import { monthQuerySchema, type MonthQuery } from './schemas/query.schemas.js';

@Controller()
export class InvoicesController {
  constructor(
    @Inject(ListInvoices) private readonly listInvoices: ListInvoices,
    @Inject(ListInvoiceEntries) private readonly listInvoiceEntries: ListInvoiceEntries,
    @Inject(PayInvoice) private readonly payInvoice: PayInvoice,
  ) {}

  @Get('invoices')
  async list(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    const result = await this.listInvoices.execute(query);
    return {
      month: result.month.toString(),
      items: result.items.map((item) => ({
        card: item.card,
        referenceMonth: item.referenceMonth.toString(),
        closingDate: item.closingDate.toString(),
        dueDate: item.dueDate.toString(),
        entryCount: item.entryCount,
        pendingCount: item.pendingCount,
        totals: presentExpenseTotals(item.totals),
      })),
    };
  }

  @Get('cards/:cardId/invoices/:referenceMonth/entries')
  async entries(@Param('cardId') cardId: string, @Param('referenceMonth') referenceMonth: string) {
    const result = await this.listInvoiceEntries.execute({ cardId, referenceMonth });
    return {
      card: result.card,
      referenceMonth: result.referenceMonth.toString(),
      items: result.items.map(presentEntry),
    };
  }

  @Post('cards/:cardId/invoices/:referenceMonth/pay')
  @HttpCode(200)
  async pay(@Param('cardId') cardId: string, @Param('referenceMonth') referenceMonth: string) {
    const result = await this.payInvoice.execute({ cardId, referenceMonth });
    return { ...result, paidAmount: result.paidAmount.toString() };
  }
}
