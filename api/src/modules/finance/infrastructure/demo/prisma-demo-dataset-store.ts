import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { YearMonth } from '@shared/domain/value-objects/year-month.js';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import type { DemoDatasetStore } from '../../application/demo/demo-dataset-store.js';
import type { Card } from '../../domain/card/card.js';
import type { Entry } from '../../domain/entry/entry.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { CardMapper } from '../mappers/card.mapper.js';
import { EntryMapper } from '../mappers/entry.mapper.js';

const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 5_000 } as const;

/** Substitui os dados do dono por `build()` sob advisory lock; `demo_datasets` guarda (âncora, versão). */
export class PrismaDemoDatasetStore implements DemoDatasetStore {
  constructor(private readonly prisma: PrismaService) {}

  async replaceIfStale(
    ownerId: OwnerId,
    anchor: YearMonth,
    version: number,
    build: () => { cards: Card[]; entries: Entry[] },
  ): Promise<boolean> {
    const anchorMonth = new Date(`${anchor.toString()}-01T00:00:00.000Z`);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`demo-dataset:${ownerId.value}`}))`);

      const current = await tx.demoDataset.findUnique({ where: { ownerId: ownerId.value } });
      if (current && current.anchorMonth.getTime() === anchorMonth.getTime() && current.templateVersion === version) {
        return false;
      }

      const { cards, entries } = build();
      await tx.entry.deleteMany({ where: { userId: ownerId.value } });
      await tx.card.deleteMany({ where: { userId: ownerId.value } });
      if (cards.length > 0) await tx.card.createMany({ data: cards.map((c) => CardMapper.toPersistence(c)) });
      if (entries.length > 0) await tx.entry.createMany({ data: entries.map((e) => EntryMapper.toPersistence(e)) });
      await tx.demoDataset.upsert({
        where: { ownerId: ownerId.value },
        create: { ownerId: ownerId.value, anchorMonth, templateVersion: version, refreshedAt: new Date() },
        update: { anchorMonth, templateVersion: version, refreshedAt: new Date() },
      });
      return true;
    }, TRANSACTION_OPTIONS);
  }
}
