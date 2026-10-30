import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { Prisma, Session as SessionRow } from '@shared/infrastructure/prisma/generated/client.js';
import { Session } from '../../domain/session/session.js';
import { SessionId } from '../../domain/session/value-objects/session-id.js';
import { SessionTokenDigest } from '../../domain/session/value-objects/session-token-digest.js';
import { UserId } from '../../domain/user/value-objects/user-id.js';

export const SessionMapper = {
  toDomain(row: SessionRow): Session {
    return Session.restore({
      id: unwrapPersisted(SessionId.create(row.id), 'sessions.id'),
      userId: unwrapPersisted(UserId.create(row.userId), 'sessions.user_id'),
      tokenDigest: unwrapPersisted(SessionTokenDigest.create(row.tokenDigest), 'sessions.token_digest'),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    });
  },

  toPersistence(session: Session): Prisma.SessionUncheckedCreateInput {
    const s = session.toSnapshot();
    return {
      id: s.id.value,
      userId: s.userId.value,
      tokenDigest: s.tokenDigest.value,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    };
  },
};
