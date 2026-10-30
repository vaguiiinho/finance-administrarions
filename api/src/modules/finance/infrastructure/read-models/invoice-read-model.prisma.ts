import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type { InvoiceReadModel, InvoiceRow } from '../../application/ports/invoice-read-model.js';
import type { EntryView } from '../../application/ports/views.js';
import type { InvoiceKey } from '../../domain/billing/invoice-key.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import { ReferenceMonth as ReferenceMonthValue } from '../../domain/billing/reference-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { EntryMapper, type EntryViewRecord } from '../mappers/entry.mapper.js';
import { ENTRY_VIEW_COLUMNS, monthStart } from '../mappers/entry-sql.js';

interface InvoiceRecord {
  card_id: string;
  card_name: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  entry_count: number;
  pending_count: number;
  paid: string;
  pending: string;
}

export class PrismaInvoiceReadModel implements InvoiceReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  /** B9: maiores closing_date/due_date entre as despesas; ordem por esse vencimento, nome do cartão, id. */
  async listByMonth(ownerId: OwnerId, month: ReferenceMonth): Promise<InvoiceRow[]> {
    const rows = await this.prisma.$queryRaw<InvoiceRecord[]>(Prisma.sql`
      SELECT c.id::text AS card_id, c.name AS card_name,
             to_char(e.reference_month, 'YYYY-MM')                                               AS reference_month,
             MAX(e.closing_date)::text                                                           AS closing_date,
             MAX(e.due_date)::text                                                               AS due_date,
             COUNT(*)::int                                                                       AS entry_count,
             COUNT(*) FILTER (WHERE e.status = 'PENDING')::int                                   AS pending_count,
             COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'PAID'), 0)::numeric(20,2)::text    AS paid,
             COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'PENDING'), 0)::numeric(20,2)::text AS pending
      FROM entries e JOIN cards c ON c.id = e.card_id
      WHERE e.user_id = ${ownerId.value}::uuid AND e.reference_month = ${monthStart(month)}::date AND e.type = 'EXPENSE' AND e.payment_method = 'CARD'
      GROUP BY c.id, c.name, c.name_key, e.reference_month
      ORDER BY MAX(e.due_date), c.name_key COLLATE "und-x-icu", c.id`);

    return rows.map((r) => ({
      card: { id: r.card_id, name: r.card_name },
      referenceMonth: unwrapPersisted(ReferenceMonthValue.parse(r.reference_month), 'invoice.reference_month'),
      closingDate: unwrapPersisted(CalendarDate.parse(r.closing_date), 'invoice.closing_date'),
      dueDate: unwrapPersisted(CalendarDate.parse(r.due_date), 'invoice.due_date'),
      entryCount: r.entry_count,
      pendingCount: r.pending_count,
      paid: unwrapPersisted(Money.parse(r.paid), 'invoice.paid'),
      pending: unwrapPersisted(Money.parse(r.pending), 'invoice.pending'),
    }));
  }

  async listEntries(ownerId: OwnerId, key: InvoiceKey): Promise<EntryView[]> {
    const rows = await this.prisma.$queryRaw<EntryViewRecord[]>(Prisma.sql`
      SELECT ${ENTRY_VIEW_COLUMNS}
      FROM entries e JOIN cards c ON c.id = e.card_id
      WHERE e.user_id = ${ownerId.value}::uuid AND e.card_id = ${key.cardId.value}::uuid AND e.reference_month = ${monthStart(key.referenceMonth)}::date
      ORDER BY e."date" DESC, e.created_at DESC, e.id DESC`);
    return rows.map((row) => EntryMapper.toView(row));
  }
}
