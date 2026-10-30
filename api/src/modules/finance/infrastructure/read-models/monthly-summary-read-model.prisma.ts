import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type { MonthlySummaryReadModel, TotalsRow } from '../../application/ports/monthly-summary-read-model.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { monthStart } from '../mappers/entry-sql.js';

export class PrismaMonthlySummaryReadModel implements MonthlySummaryReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  /** Sem nenhum filtro além do mês, por construção. */
  async summary(ownerId: OwnerId, month: ReferenceMonth): Promise<TotalsRow> {
    const [row] = await this.prisma.$queryRaw<{ income: string; expenses_paid: string; expenses_pending: string }[]>(
      Prisma.sql`
        SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)::numeric(20,2)::text                       AS income,
               COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PAID'), 0)::numeric(20,2)::text    AS expenses_paid,
               COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND status = 'PENDING'), 0)::numeric(20,2)::text AS expenses_pending
        FROM entries WHERE user_id = ${ownerId.value}::uuid AND reference_month = ${monthStart(month)}::date`,
    );
    return {
      income: unwrapPersisted(Money.parse(row!.income), 'summary.income'),
      paidExpenses: unwrapPersisted(Money.parse(row!.expenses_paid), 'summary.expenses_paid'),
      pendingExpenses: unwrapPersisted(Money.parse(row!.expenses_pending), 'summary.expenses_pending'),
    };
  }
}
