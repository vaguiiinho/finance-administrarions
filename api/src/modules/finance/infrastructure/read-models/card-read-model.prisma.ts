import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { CardReadModel, CardView } from '../../application/ports/card-read-model.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { CardId } from '../../domain/card/value-objects/card-id.js';

interface CardRecord {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  created_at: Date;
  updated_at: Date;
}

const toView = (r: CardRecord): CardView => ({
  id: r.id,
  name: r.name,
  closingDay: r.closing_day,
  dueDay: r.due_day,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class PrismaCardReadModel implements CardReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  async listAll(ownerId: OwnerId): Promise<CardView[]> {
    const rows = await this.prisma.$queryRaw<CardRecord[]>(Prisma.sql`
      SELECT id::text AS id, name, closing_day::int AS closing_day, due_day::int AS due_day, created_at, updated_at
      FROM cards WHERE user_id = ${ownerId.value}::uuid
      ORDER BY name_key COLLATE "und-x-icu", id`);
    return rows.map(toView);
  }

  async findById(ownerId: OwnerId, id: CardId): Promise<CardView | null> {
    const rows = await this.prisma.$queryRaw<CardRecord[]>(Prisma.sql`
      SELECT id::text AS id, name, closing_day::int AS closing_day, due_day::int AS due_day, created_at, updated_at
      FROM cards WHERE user_id = ${ownerId.value}::uuid AND id = ${id.value}::uuid`);
    return rows.length > 0 ? toView(rows[0]!) : null;
  }
}
