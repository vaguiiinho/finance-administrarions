import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import type { ShowcaseDataPurger } from '../../application/ports/showcase-data-purger.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';

/** Apaga lançamentos e depois cartões antigos do dono, na mesma transação (entries.card_id é RESTRICT). */
export class PrismaShowcaseDataPurger implements ShowcaseDataPurger {
  constructor(private readonly prisma: PrismaService) {}

  async purgeCreatedBefore(ownerId: OwnerId, before: Date): Promise<{ entries: number; cards: number }> {
    return this.prisma.$transaction(async (tx) => {
      const entries = await tx.$executeRaw(
        Prisma.sql`DELETE FROM entries WHERE user_id = ${ownerId.value}::uuid AND created_at < ${before}`,
      );
      const cards = await tx.$executeRaw(
        Prisma.sql`DELETE FROM cards c WHERE c.user_id = ${ownerId.value}::uuid AND c.created_at < ${before}
                   AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.card_id = c.id)`,
      );
      return { entries, cards };
    });
  }
}
