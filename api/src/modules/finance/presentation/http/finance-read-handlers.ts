import { Inject, Injectable } from '@nestjs/common';
import { GetCategoryDistribution } from '../../application/use-cases/dashboard/get-category-distribution.js';
import { GetMonthlySeries } from '../../application/use-cases/dashboard/get-monthly-series.js';
import { ListCategories } from '../../application/use-cases/entries/list-categories.js';
import { ListExpenses } from '../../application/use-cases/entries/list-expenses.js';
import { ListIncomes } from '../../application/use-cases/entries/list-incomes.js';
import { ListCards } from '../../application/use-cases/cards/list-cards.js';
import { ListInvoiceEntries } from '../../application/use-cases/invoices/list-invoice-entries.js';
import { ListInvoices } from '../../application/use-cases/invoices/list-invoices.js';
import { GetMonthlySummary } from '../../application/use-cases/summary/get-monthly-summary.js';
import { presentCard } from './presenters/card.presenter.js';
import { presentEntry } from './presenters/entry.presenter.js';
import { presentExpenseTotals, presentPagination, presentTotals } from './presenters/totals.presenter.js';
import type { ExpensesQuery, IncomesQuery, MonthQuery } from './schemas/query.schemas.js';

/**
 * Leituras do finance montadas uma só vez: os controllers protegidos passam o dono do principal e as rotas públicas
 * da demo passam o dono fixo `DEMO_USER_ID`, com o MESMO contrato de resposta (ADR 0005 6.5).
 */
@Injectable()
export class FinanceReadHandlers {
  constructor(
    @Inject(ListExpenses) private readonly listExpenses: ListExpenses,
    @Inject(ListIncomes) private readonly listIncomes: ListIncomes,
    @Inject(ListCategories) private readonly listCategories: ListCategories,
    @Inject(ListCards) private readonly listCards: ListCards,
    @Inject(ListInvoices) private readonly listInvoices: ListInvoices,
    @Inject(ListInvoiceEntries) private readonly listInvoiceEntries: ListInvoiceEntries,
    @Inject(GetMonthlySummary) private readonly getMonthlySummary: GetMonthlySummary,
    @Inject(GetMonthlySeries) private readonly getMonthlySeries: GetMonthlySeries,
    @Inject(GetCategoryDistribution) private readonly getCategoryDistribution: GetCategoryDistribution,
  ) {}

  async expenses(ownerId: string, query: ExpensesQuery) {
    const result = await this.listExpenses.execute({ ownerId, ...query });
    return {
      month: result.month.toString(),
      items: result.items.map(presentEntry),
      pagination: presentPagination(result.pagination),
      subtotal: presentExpenseTotals(result.subtotal),
    };
  }

  async incomes(ownerId: string, query: IncomesQuery) {
    const result = await this.listIncomes.execute({ ownerId, ...query });
    return {
      month: result.month.toString(),
      items: result.items.map(presentEntry),
      pagination: presentPagination(result.pagination),
      subtotal: { total: result.subtotal.toString() },
    };
  }

  categories(ownerId: string) {
    return this.listCategories.execute({ ownerId });
  }

  async cards(ownerId: string) {
    const { items } = await this.listCards.execute({ ownerId });
    return { items: items.map(presentCard) };
  }

  async invoices(ownerId: string, query: MonthQuery) {
    const result = await this.listInvoices.execute({ ownerId, ...query });
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

  async invoiceEntries(ownerId: string, cardId: string, referenceMonth: string) {
    const result = await this.listInvoiceEntries.execute({ ownerId, cardId, referenceMonth });
    return {
      card: result.card,
      referenceMonth: result.referenceMonth.toString(),
      items: result.items.map(presentEntry),
    };
  }

  async summary(ownerId: string, query: MonthQuery) {
    const result = await this.getMonthlySummary.execute({ ownerId, ...query });
    return { month: result.month.toString(), totals: presentTotals(result.totals) };
  }

  async monthlySeries(ownerId: string, query: MonthQuery) {
    const result = await this.getMonthlySeries.execute({ ownerId, ...query });
    return {
      from: result.from.toString(),
      to: result.to.toString(),
      points: result.points.map((point) => ({ month: point.month.toString(), totals: presentTotals(point.totals) })),
    };
  }

  async categoryDistribution(ownerId: string, query: MonthQuery) {
    const result = await this.getCategoryDistribution.execute({ ownerId, ...query });
    return {
      month: result.month.toString(),
      total: result.total.toString(),
      items: result.items.map((item) => ({
        category: item.category,
        total: item.total.toString(),
        percentage: item.percentage,
      })),
    };
  }
}
