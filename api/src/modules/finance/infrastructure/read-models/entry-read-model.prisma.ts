import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type {
  EntryReadModel,
  ExpenseListCriteria,
  ExpenseSubtotalRow,
  IncomeListCriteria,
} from '../../application/ports/entry-read-model.js';
import type { EntryView, Page, Paging } from '../../application/ports/views.js';
import type { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { EntryMapper, type EntryViewRecord } from '../mappers/entry.mapper.js';
import { ENTRY_VIEW_COLUMNS, monthStart } from '../mappers/entry-sql.js';

/** Acesso a `$transaction` em lote (mesmo snapshot para página e subtotal). */
type BatchCapable = PrismaExecutor & {
  $transaction: <T extends Prisma.PrismaPromise<unknown>[]>(
    queries: [...T],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ) => Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

export class PrismaEntryReadModel implements EntryReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  async listExpenses(ownerId: OwnerId, c: ExpenseListCriteria): Promise<Page<EntryView> & { subtotal: ExpenseSubtotalRow }> {
    const conditions = [
      Prisma.sql`e.user_id = ${ownerId.value}::uuid`,
      Prisma.sql`e.reference_month = ${monthStart(c.month)}::date`,
      Prisma.sql`e.type = 'EXPENSE'`,
    ];
    if (c.status) conditions.push(Prisma.sql`e.status = ${c.status}::entry_status`);
    if (c.categoryKey !== undefined) conditions.push(Prisma.sql`e.category_key = ${c.categoryKey}`);
    if (c.card.kind === 'card') conditions.push(Prisma.sql`e.card_id = ${c.card.cardId.value}::uuid`);
    if (c.card.kind === 'pix') conditions.push(Prisma.sql`e.payment_method = 'PIX'`);
    const where = Prisma.join(conditions, ' AND ');

    const [rows, totals] = await this.snapshot(
      this.pageQuery(where, c.paging),
      this.prisma.$queryRaw<{ total_items: number; paid: string; pending: string }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total_items,
               COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::numeric(20,2)::text    AS paid,
               COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0)::numeric(20,2)::text AS pending
        FROM entries e WHERE ${where}`),
    );
    const t = totals[0]!;
    return {
      items: rows.map((row) => EntryMapper.toView(row)),
      totalItems: t.total_items,
      subtotal: {
        paid: unwrapPersisted(Money.parse(t.paid), 'subtotal.paid'),
        pending: unwrapPersisted(Money.parse(t.pending), 'subtotal.pending'),
      },
    };
  }

  async listIncomes(ownerId: OwnerId, c: IncomeListCriteria): Promise<Page<EntryView> & { subtotal: Money }> {
    const conditions = [
      Prisma.sql`e.user_id = ${ownerId.value}::uuid`,
      Prisma.sql`e.reference_month = ${monthStart(c.month)}::date`,
      Prisma.sql`e.type = 'INCOME'`,
    ];
    if (c.categoryKey !== undefined) conditions.push(Prisma.sql`e.category_key = ${c.categoryKey}`);
    const where = Prisma.join(conditions, ' AND ');

    const [rows, totals] = await this.snapshot(
      this.pageQuery(where, c.paging),
      this.prisma.$queryRaw<{ total_items: number; total: string }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total_items, COALESCE(SUM(amount), 0)::numeric(20,2)::text AS total
        FROM entries e WHERE ${where}`),
    );
    const t = totals[0]!;
    return {
      items: rows.map((row) => EntryMapper.toView(row)),
      totalItems: t.total_items,
      subtotal: unwrapPersisted(Money.parse(t.total), 'subtotal.total'),
    };
  }

  async findById(ownerId: OwnerId, id: EntryId): Promise<EntryView | null> {
    const rows = await this.prisma.$queryRaw<EntryViewRecord[]>(Prisma.sql`
      SELECT ${ENTRY_VIEW_COLUMNS}
      FROM entries e LEFT JOIN cards c ON c.id = e.card_id
      WHERE e.user_id = ${ownerId.value}::uuid AND e.id = ${id.value}::uuid`);
    return rows.length > 0 ? EntryMapper.toView(rows[0]!) : null;
  }

  private pageQuery(where: Prisma.Sql, paging: Paging) {
    return this.prisma.$queryRaw<EntryViewRecord[]>(Prisma.sql`
      SELECT ${ENTRY_VIEW_COLUMNS}
      FROM entries e LEFT JOIN cards c ON c.id = e.card_id
      WHERE ${where}
      ORDER BY e."date" DESC, e.created_at DESC, e.id DESC
      LIMIT ${paging.pageSize}::int OFFSET ${(paging.page - 1) * paging.pageSize}::int`);
  }

  /**
   * Página e subtotal no mesmo snapshot (RepeatableRead) quando o executor é o cliente raiz.
   * Dentro de uma transação já aberta, as duas consultas rodam nela.
   */
  private snapshot<A, B>(page: Prisma.PrismaPromise<A>, totals: Prisma.PrismaPromise<B>): Promise<[A, B]> {
    const root = this.prisma as Partial<BatchCapable>;
    if (typeof root.$transaction === 'function') {
      return root.$transaction([page, totals], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) as Promise<
        [A, B]
      >;
    }
    return Promise.all([page, totals]);
  }
}
