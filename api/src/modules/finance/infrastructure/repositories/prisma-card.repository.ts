import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { Card } from '../../domain/card/card.js';
import type { CardRepository } from '../../domain/card/card.repository.js';
import { CardNameTakenError } from '../../domain/card/errors/card-errors.js';
import type { CardId } from '../../domain/card/value-objects/card-id.js';
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
      await this.prisma.card.update({
        where: { id: card.id.value },
        data: { name, nameKey, closingDay, dueDay, updatedAt },
      });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async findById(id: CardId): Promise<Card | null> {
    const row = await this.prisma.card.findUnique({ where: { id: id.value } });
    return row ? CardMapper.toDomain(row) : null;
  }

  async findByNameKey(key: string): Promise<Card | null> {
    const row = await this.prisma.card.findUnique({ where: { nameKey: key } });
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
  return /name_key|cards_name_key_uq/.test(JSON.stringify(error.meta ?? {}));
}
