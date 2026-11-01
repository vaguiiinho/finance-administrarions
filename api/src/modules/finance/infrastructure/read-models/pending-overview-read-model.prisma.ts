import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { PendingOverview, PendingOverviewReadModel } from '../../application/ports/pending-overview-read-model.js';
import { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { monthStart } from '../mappers/entry-sql.js';

interface PendingOverviewRecord {
  first_pending_month: string | null;
  oldest_pending_card_month: string | null;
  has_card: boolean;
}

export class PrismaPendingOverviewReadModel implements PendingOverviewReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  /** Uma única consulta: próxima pendência, fatura de cartão pendente mais antiga e existência de cartão. */
  async overviewFrom(ownerId: OwnerId, from: ReferenceMonth): Promise<PendingOverview> {
    const [row] = await this.prisma.$queryRaw<PendingOverviewRecord[]>(Prisma.sql`
      SELECT
        (SELECT to_char(MIN(e.reference_month), 'YYYY-MM')
           FROM entries e
          WHERE e.user_id = ${ownerId.value}::uuid AND e.reference_month >= ${monthStart(from)}::date
            AND e.type = 'EXPENSE' AND e.status = 'PENDING') AS first_pending_month,
        (SELECT to_char(MIN(e.reference_month), 'YYYY-MM')
           FROM entries e
          WHERE e.user_id = ${ownerId.value}::uuid
            AND e.type = 'EXPENSE' AND e.payment_method = 'CARD' AND e.status = 'PENDING') AS oldest_pending_card_month,
        EXISTS (SELECT 1 FROM cards c WHERE c.user_id = ${ownerId.value}::uuid) AS has_card`);
    return {
      firstPendingMonth: row.first_pending_month
        ? unwrapPersisted(ReferenceMonth.parse(row.first_pending_month), 'entry.reference_month')
        : null,
      oldestPendingCardMonth: row.oldest_pending_card_month
        ? unwrapPersisted(ReferenceMonth.parse(row.oldest_pending_card_month), 'entry.reference_month')
        : null,
      hasCard: row.has_card,
    };
  }
}
