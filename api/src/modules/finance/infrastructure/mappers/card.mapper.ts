import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { Card as CardRow, Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import { ClosingDay, DueDay } from '../../domain/billing/day-of-month.js';
import { Card } from '../../domain/card/card.js';
import { CardId } from '../../domain/card/value-objects/card-id.js';
import { CardName } from '../../domain/card/value-objects/card-name.js';
import { OwnerId } from '../../domain/owner/owner-id.js';
import type { CardView } from '../../application/ports/card-read-model.js';

export const CardMapper = {
  toDomain(row: CardRow): Card {
    return Card.restore({
      id: unwrapPersisted(CardId.create(row.id), 'cards.id'),
      ownerId: unwrapPersisted(OwnerId.create(row.userId), 'cards.user_id'),
      name: unwrapPersisted(CardName.create(row.name), 'cards.name'),
      closingDay: unwrapPersisted(ClosingDay.create(row.closingDay), 'cards.closing_day'),
      dueDay: unwrapPersisted(DueDay.create(row.dueDay), 'cards.due_day'),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(card: Card): Prisma.CardUncheckedCreateInput {
    const s = card.toSnapshot();
    return {
      id: s.id.value,
      userId: s.ownerId.value,
      name: s.name.value,
      nameKey: s.name.key,
      closingDay: s.closingDay.value,
      dueDay: s.dueDay.value,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  },

  toView(row: CardRow): CardView {
    return {
      id: row.id,
      name: row.name,
      closingDay: row.closingDay,
      dueDay: row.dueDay,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};
