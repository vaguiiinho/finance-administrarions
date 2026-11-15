import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { InvoiceKey } from '../../domain/billing/invoice-key.js';
import type { Entry } from '../../domain/entry/entry.js';
import type { EntryRepository } from '../../domain/entry/entry.repository.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import { EntryMapper, type EntryRecord } from '../mappers/entry.mapper.js';
import { ENTRY_RECORD_COLUMNS, monthStart } from '../mappers/entry-sql.js';

export class PrismaEntryRepository implements EntryRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async insert(entry: Entry): Promise<void> {
    await this.prisma.entry.create({ data: EntryMapper.toPersistence(entry) });
  }

  async findByIdsForUpdate(ownerId: OwnerId, ids: readonly EntryId[]): Promise<Entry[]> {
    const values = ids.map((id) => id.value);
    const rows = await this.prisma.$queryRaw<EntryRecord[]>(Prisma.sql`
      SELECT ${ENTRY_RECORD_COLUMNS}
      FROM entries e
      WHERE e.user_id = ${ownerId.value}::uuid AND e.id = ANY(${values}::uuid[])
      ORDER BY e.id
      FOR UPDATE OF e`);
    return rows.map((row) => EntryMapper.toDomain(row));
  }

  async findPendingByInvoiceForUpdate(ownerId: OwnerId, key: InvoiceKey): Promise<Entry[]> {
    const rows = await this.prisma.$queryRaw<EntryRecord[]>(Prisma.sql`
      SELECT ${ENTRY_RECORD_COLUMNS}
      FROM entries e
      WHERE e.user_id = ${ownerId.value}::uuid
        AND e.card_id = ${key.cardId.value}::uuid
        AND e.reference_month = ${monthStart(key.referenceMonth)}::date
        AND e.status = 'PENDING'
      ORDER BY e.id
      FOR UPDATE OF e`);
    return rows.map((row) => EntryMapper.toDomain(row));
  }

  async update(entry: Entry): Promise<void> {
    const { id, userId, createdAt, ...data } = EntryMapper.toPersistence(entry);
    const { count } = await this.prisma.entry.updateMany({
      where: { id, userId, type: 'EXPENSE' },
      data: { ...data, createdAt },
    });
    if (count !== 1) {
      throw new InvariantViolationError('update: lançamento não atualizado (contrato de lock violado).');
    }
  }

  async delete(entry: Entry): Promise<void> {
    const snapshot = entry.toSnapshot();
    const { count } = await this.prisma.entry.deleteMany({
      where: { id: snapshot.id.value, userId: snapshot.ownerId.value, type: 'EXPENSE' },
    });
    if (count !== 1) {
      throw new InvariantViolationError('delete: lançamento não removido (contrato de lock violado).');
    }
  }

  async saveAll(entries: readonly Entry[]): Promise<void> {
    if (entries.length === 0) return;
    const snapshots = entries.map((entry) => entry.toSnapshot());
    const affected = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE entries AS e
      SET status = v.status::entry_status, paid_at = v.paid_at, updated_at = v.updated_at
      FROM unnest(
        ${snapshots.map((s) => s.id.value)}::uuid[],
        ${snapshots.map((s) => s.ownerId.value)}::uuid[],
        ${snapshots.map((s) => s.status)}::text[],
        ${snapshots.map((s) => s.paidAt?.toISOString() ?? null)}::timestamptz[],
        ${snapshots.map((s) => s.updatedAt.toISOString())}::timestamptz[]
      ) AS v(id, user_id, status, paid_at, updated_at)
      WHERE e.id = v.id AND e.user_id = v.user_id AND e.type = 'EXPENSE' AND e.status = 'PENDING'`);
    if (affected !== entries.length) {
      throw new Error(`saveAll: ${affected} de ${entries.length} linhas atualizadas (contrato de lock violado).`);
    }
  }
}
