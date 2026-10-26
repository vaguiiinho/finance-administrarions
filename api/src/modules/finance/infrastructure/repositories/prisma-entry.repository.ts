import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { InvoiceKey } from '../../domain/billing/invoice-key.js';
import type { Entry } from '../../domain/entry/entry.js';
import type { EntryRepository } from '../../domain/entry/entry.repository.js';
import type { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import { EntryMapper, type EntryRecord } from '../mappers/entry.mapper.js';
import { ENTRY_RECORD_COLUMNS, monthStart } from '../mappers/entry-sql.js';

export class PrismaEntryRepository implements EntryRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async insert(entry: Entry): Promise<void> {
    await this.prisma.entry.create({ data: EntryMapper.toPersistence(entry) });
  }

  async findByIdsForUpdate(ids: readonly EntryId[]): Promise<Entry[]> {
    const values = ids.map((id) => id.value);
    const rows = await this.prisma.$queryRaw<EntryRecord[]>(Prisma.sql`
      SELECT ${ENTRY_RECORD_COLUMNS}
      FROM entries e
      WHERE e.id = ANY(${values}::uuid[])
      ORDER BY e.id
      FOR UPDATE OF e`);
    return rows.map((row) => EntryMapper.toDomain(row));
  }

  async findPendingByInvoiceForUpdate(key: InvoiceKey): Promise<Entry[]> {
    const rows = await this.prisma.$queryRaw<EntryRecord[]>(Prisma.sql`
      SELECT ${ENTRY_RECORD_COLUMNS}
      FROM entries e
      WHERE e.card_id = ${key.cardId.value}::uuid
        AND e.reference_month = ${monthStart(key.referenceMonth)}::date
        AND e.status = 'PENDING'
      ORDER BY e.id
      FOR UPDATE OF e`);
    return rows.map((row) => EntryMapper.toDomain(row));
  }

  async saveAll(entries: readonly Entry[]): Promise<void> {
    if (entries.length === 0) return;
    const snapshots = entries.map((entry) => entry.toSnapshot());
    const affected = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE entries AS e
      SET status = v.status::entry_status, paid_at = v.paid_at, updated_at = v.updated_at
      FROM unnest(
        ${snapshots.map((s) => s.id.value)}::uuid[],
        ${snapshots.map((s) => s.status)}::text[],
        ${snapshots.map((s) => s.paidAt?.toISOString() ?? null)}::timestamptz[],
        ${snapshots.map((s) => s.updatedAt.toISOString())}::timestamptz[]
      ) AS v(id, status, paid_at, updated_at)
      WHERE e.id = v.id AND e.type = 'EXPENSE' AND e.status = 'PENDING'`);
    if (affected !== entries.length) {
      throw new Error(`saveAll: ${affected} de ${entries.length} linhas atualizadas (contrato de lock violado).`);
    }
  }
}
