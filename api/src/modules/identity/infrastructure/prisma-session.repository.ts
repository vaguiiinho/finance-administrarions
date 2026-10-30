import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import type { Session } from '../domain/session/session.js';
import type { SessionRepository } from '../domain/session/session.repository.js';
import type { SessionId } from '../domain/session/value-objects/session-id.js';
import type { SessionTokenDigest } from '../domain/session/value-objects/session-token-digest.js';
import type { UserId } from '../domain/user/value-objects/user-id.js';
import { SessionMapper } from './mappers/session.mapper.js';

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async insert(session: Session): Promise<void> {
    await this.prisma.session.create({ data: SessionMapper.toPersistence(session) });
  }

  async findActiveByDigest(digest: SessionTokenDigest, now: Date): Promise<Session | null> {
    const row = await this.prisma.session.findFirst({
      where: { tokenDigest: digest.value, expiresAt: { gt: now } },
    });
    return row ? SessionMapper.toDomain(row) : null;
  }

  async delete(id: SessionId): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: id.value } });
  }

  async deleteAllOfUser(userId: UserId): Promise<number> {
    return (await this.prisma.session.deleteMany({ where: { userId: userId.value } })).count;
  }

  async deleteAllOfUserExcept(userId: UserId, keep: SessionId): Promise<number> {
    return (await this.prisma.session.deleteMany({ where: { userId: userId.value, id: { not: keep.value } } })).count;
  }

  async deleteExpired(now: Date): Promise<number> {
    return (await this.prisma.session.deleteMany({ where: { expiresAt: { lte: now } } })).count;
  }
}
