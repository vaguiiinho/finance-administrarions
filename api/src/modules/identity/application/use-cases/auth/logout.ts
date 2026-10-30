import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { SessionRepository } from '../../../domain/session/session.repository.js';
import type { SessionTokenIssuer } from '../../ports/session-token-issuer.js';

export class Logout {
  constructor(
    private readonly tokens: SessionTokenIssuer,
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Idempotente: token ausente, inválido ou já encerrado não é erro. */
  async execute(input: { token: string | null }): Promise<void> {
    if (!input.token) return;
    const digest = this.tokens.digest(input.token);
    if (!digest) return;
    const now = this.clock.now();
    const session = await this.sessions.findActiveByDigest(digest, now);
    if (!session) return;
    session.revoke(now);
    await this.sessions.delete(session.id);
    await this.publisher.publish(session.pullEvents());
  }
}
