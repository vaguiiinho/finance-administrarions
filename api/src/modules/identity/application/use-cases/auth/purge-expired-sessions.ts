import type { Clock } from '@shared/application/ports/clock.js';
import type { SessionRepository } from '../../../domain/session/session.repository.js';

export class PurgeExpiredSessions {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(_input: Record<string, never>): Promise<{ deleted: number }> {
    return { deleted: await this.sessions.deleteExpired(this.clock.now()) };
  }
}
