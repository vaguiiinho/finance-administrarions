import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { CategoryCatalog } from '../../domain/entry/category-catalog.js';
import { Category } from '../../domain/entry/value-objects/category.js';

export class PrismaCategoryCatalog implements CategoryCatalog {
  constructor(private readonly prisma: PrismaExecutor) {}

  async findByKey(ownerId: OwnerId, key: string): Promise<Category | null> {
    const rows = await this.prisma.$queryRaw<{ category: string }[]>(Prisma.sql`
      SELECT category FROM entries WHERE user_id = ${ownerId.value}::uuid AND category_key = ${key} ORDER BY created_at, id LIMIT 1`);
    return rows.length > 0 ? unwrapPersisted(Category.create(rows[0]!.category), 'entries.category') : null;
  }
}
