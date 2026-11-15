import { InvariantViolationError } from '@shared/domain/app-error.js';
import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import type {
  OwnerDataResetOutcome,
  OwnerDataResetRequest,
  OwnerDataResetStore,
  ResetCondition,
} from '../../application/ports/owner-data-reset-store.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { CardMapper } from '../mappers/card.mapper.js';
import { EntryMapper } from '../mappers/entry.mapper.js';

const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 5_000 } as const;

interface ControlRow {
  anchorMonth: Date | null;
  templateVersion: number | null;
  lastResetAt: Date;
}

/**
 * Apaga e restaura os dados de UM dono numa transação só, sob advisory lock por dono. A condição é avaliada sob o mesmo
 * lock da escrita (duas réplicas, seed e rotina não rodam duas vezes); `owner_data_resets` guarda o controle.
 */
export class PrismaOwnerDataResetStore implements OwnerDataResetStore {
  constructor(private readonly prisma: PrismaService) {}

  async reset(ownerId: OwnerId, request: OwnerDataResetRequest): Promise<OwnerDataResetOutcome> {
    const { sample, condition, at } = request;
    if (condition.kind === 'sample-stale' && sample === null) {
      throw new InvariantViolationError("A condição 'sample-stale' exige um dataset de exemplo.");
    }
    const anchorMonth = sample ? new Date(`${sample.anchor.toString()}-01T00:00:00.000Z`) : null;
    const templateVersion = sample ? sample.version : null;

    return this.prisma.$transaction(async (tx): Promise<OwnerDataResetOutcome> => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`owner-data-reset:${ownerId.value}`}))`);

      const current = await tx.ownerDataReset.findUnique({ where: { ownerId: ownerId.value } });
      if (!shouldReset(condition, current, anchorMonth, templateVersion)) return { status: 'skipped' };

      const dataset = sample ? sample.build() : null;
      const deletedEntries = await tx.$executeRaw(Prisma.sql`DELETE FROM entries WHERE user_id = ${ownerId.value}::uuid`);
      const deletedCards = await tx.$executeRaw(Prisma.sql`DELETE FROM cards WHERE user_id = ${ownerId.value}::uuid`);
      if (dataset && dataset.cards.length > 0) {
        await tx.card.createMany({ data: dataset.cards.map((c) => CardMapper.toPersistence(c)) });
      }
      if (dataset && dataset.entries.length > 0) {
        await tx.entry.createMany({ data: dataset.entries.map((e) => EntryMapper.toPersistence(e)) });
      }
      await tx.ownerDataReset.upsert({
        where: { ownerId: ownerId.value },
        create: { ownerId: ownerId.value, anchorMonth, templateVersion, lastResetAt: at },
        update: { anchorMonth, templateVersion, lastResetAt: at },
      });
      return {
        status: 'reset',
        deleted: { entries: deletedEntries, cards: deletedCards },
        restored: { entries: dataset?.entries.length ?? 0, cards: dataset?.cards.length ?? 0 },
      };
    }, TRANSACTION_OPTIONS);
  }
}

function shouldReset(
  condition: ResetCondition,
  current: ControlRow | null,
  anchorMonth: Date | null,
  templateVersion: number | null,
): boolean {
  switch (condition.kind) {
    case 'always':
      return true;
    case 'not-reset-since':
      return current === null || current.lastResetAt.getTime() < condition.since.getTime();
    case 'sample-stale':
      return (
        current === null ||
        current.anchorMonth === null ||
        current.anchorMonth.getTime() !== anchorMonth?.getTime() ||
        current.templateVersion !== templateVersion
      );
  }
}
