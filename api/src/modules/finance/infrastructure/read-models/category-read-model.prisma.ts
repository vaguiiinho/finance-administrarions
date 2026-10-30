import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { CategoryReadModel } from '../../application/ports/category-read-model.js';

export class PrismaCategoryReadModel implements CategoryReadModel {
  constructor(private readonly prisma: PrismaExecutor) {}

  /** Uma categoria por chave (receitas e despesas), com a grafia do primeiro uso. */
  async listDistinct(ownerId: OwnerId): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ category: string }[]>(Prisma.sql`
      SELECT category FROM (
        SELECT DISTINCT ON (category_key) category_key, category
        FROM entries WHERE user_id = ${ownerId.value}::uuid ORDER BY category_key, created_at, id
      ) c ORDER BY category_key`);
    return rows.map((r) => r.category);
  }
}
