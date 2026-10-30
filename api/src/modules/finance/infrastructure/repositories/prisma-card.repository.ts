import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { Card } from '../../domain/card/card.js';
import type { CardRepository } from '../../domain/card/card.repository.js';
import { CardNameTakenError } from '../../domain/card/errors/card-errors.js';
import type { CardId } from '../../domain/card/value-objects/card-id.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import { CardMapper } from '../mappers/card.mapper.js';

export class PrismaCardRepository implements CardRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async insert(card: Card): Promise<void> {
    try {
      await this.prisma.card.create({ data: CardMapper.toPersistence(card) });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async update(card: Card): Promise<void> {
    const { name, nameKey, closingDay, dueDay, updatedAt } = CardMapper.toPersistence(card);
    try {
      const { count } = await this.prisma.card.updateMany({
        where: { id: card.id.value, userId: card.ownerId.value },
        data: { name, nameKey, closingDay, dueDay, updatedAt },
      });
      if (count !== 1) throw new InvariantViolationError('Cartão a atualizar não existe para este dono.');
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async findById(ownerId: OwnerId, id: CardId): Promise<Card | null> {
    const row = await this.prisma.card.findFirst({ where: { id: id.value, userId: ownerId.value } });
    return row ? CardMapper.toDomain(row) : null;
  }

  async findByNameKey(ownerId: OwnerId, key: string): Promise<Card | null> {
    const row = await this.prisma.card.findUnique({ where: { userId_nameKey: { userId: ownerId.value, nameKey: key } } });
    return row ? CardMapper.toDomain(row) : null;
  }
}

/** Único ponto que conhece o código P2002 do Prisma: unique de name_key -> CardNameTakenError. */
function translateUniqueViolation(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && isNameKeyViolation(error)) {
    return new CardNameTakenError();
  }
  return error;
}

/** Com driver adapter o alvo vem em formatos distintos (target, constraint.fields...): inspeciona o meta inteiro. */
function isNameKeyViolation(error: Prisma.PrismaClientKnownRequestError): boolean {
  return /name_key|cards_owner_name_key_uq/.test(JSON.stringify(error.meta ?? {}));
}
