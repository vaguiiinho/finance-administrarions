import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { CategoryCatalog } from '../../domain/entry/category-catalog.js';
import { Category } from '../../domain/entry/value-objects/category.js';

export class PrismaCategoryCatalog implements CategoryCatalog {
  constructor(private readonly prisma: PrismaExecutor) {}

  async findByKey(key: string): Promise<Category | null> {
    const rows = await this.prisma.$queryRaw<{ category: string }[]>(Prisma.sql`
      SELECT category FROM entries WHERE category_key = ${key} ORDER BY created_at, id LIMIT 1`);
    return rows.length > 0 ? unwrapPersisted(Category.create(rows[0]!.category), 'entries.category') : null;
  }
}
