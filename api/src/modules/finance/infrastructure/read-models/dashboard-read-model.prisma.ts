import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type { CategoryShare, DashboardReadModel, MonthlyRow } from '../../application/ports/dashboard-read-model.js';
import { ReferenceMonth } from '../../domain/billing/reference-month.js';
import { monthStart } from '../mappers/entry-sql.js';

export class PrismaDashboardReadModel implements DashboardReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  /** Série contínua com zeros nos meses sem lançamentos. */
  async monthlySeries(from: ReferenceMonth, to: ReferenceMonth): Promise<MonthlyRow[]> {
    const rows = await this.prisma.$queryRaw<
      { month: string; income: string; expenses_paid: string; expenses_pending: string }[]
    >(Prisma.sql`
      WITH agg AS (
        SELECT reference_month,
               SUM(amount) FILTER (WHERE type = 'INCOME')                         AS income,
               SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PAID')    AS paid,
               SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PENDING') AS pending
        FROM entries
        WHERE reference_month BETWEEN ${monthStart(from)}::date AND ${monthStart(to)}::date
        GROUP BY reference_month
      )
      SELECT to_char(m.month, 'YYYY-MM')                 AS month,
             COALESCE(a.income, 0)::numeric(20,2)::text  AS income,
             COALESCE(a.paid, 0)::numeric(20,2)::text    AS expenses_paid,
             COALESCE(a.pending, 0)::numeric(20,2)::text AS expenses_pending
      FROM generate_series(${monthStart(from)}::date, ${monthStart(to)}::date, interval '1 month') AS m(month)
      LEFT JOIN agg a ON a.reference_month = m.month::date
      ORDER BY m.month`);

    return rows.map((r) => ({
      month: unwrapPersisted(ReferenceMonth.parse(r.month), 'series.month'),
      totals: {
        income: unwrapPersisted(Money.parse(r.income), 'series.income'),
        paidExpenses: unwrapPersisted(Money.parse(r.expenses_paid), 'series.expenses_paid'),
        pendingExpenses: unwrapPersisted(Money.parse(r.expenses_pending), 'series.expenses_pending'),
      },
    }));
  }

  /** Só despesas, por categoria (chave case-insensitive), em ordem decrescente de total. */
  async expenseDistribution(month: ReferenceMonth): Promise<CategoryShare[]> {
    const rows = await this.prisma.$queryRaw<{ category: string; total: string; percentage: string }[]>(Prisma.sql`
      SELECT (array_agg(category ORDER BY created_at, id))[1]             AS category,
             SUM(amount)::numeric(20,2)::text                             AS total,
             ROUND(SUM(amount) * 100 / SUM(SUM(amount)) OVER (), 2)::text AS percentage
      FROM entries
      WHERE reference_month = ${monthStart(month)}::date AND type = 'EXPENSE'
      GROUP BY category_key
      ORDER BY SUM(amount) DESC, category_key`);

    return rows.map((r) => ({
      category: r.category,
      total: unwrapPersisted(Money.parse(r.total), 'distribution.total'),
      percentage: r.percentage,
    }));
  }
}
