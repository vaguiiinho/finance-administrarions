import { AggregateRoot } from '@shared/domain/aggregate-root.js';
import type { UserId } from '../user/value-objects/user-id.js';
import { SessionOpened, SessionRevoked, type SessionDomainEvent } from './events/session-events.js';
import { SessionPolicy } from './session-policy.js';
import type { SessionId } from './value-objects/session-id.js';
import type { SessionTokenDigest } from './value-objects/session-token-digest.js';

export interface SessionSnapshot {
  id: SessionId;
  userId: UserId;
  tokenDigest: SessionTokenDigest;
  createdAt: Date;
  expiresAt: Date;
}

export class Session extends AggregateRoot<SessionDomainEvent> {
  private constructor(private readonly state: SessionSnapshot) {
    super();
  }

  /** expiresAt = createdAt + 24 h. Emite SessionOpened. */
  static open(p: { id: SessionId; userId: UserId; tokenDigest: SessionTokenDigest; now: Date }): Session {
    const session = new Session({
      id: p.id,
      userId: p.userId,
      tokenDigest: p.tokenDigest,
      createdAt: p.now,
      expiresAt: SessionPolicy.expiresAt(p.now),
    });
    session.record(new SessionOpened(p.id.value, p.userId.value, p.now));
    return session;
  }

  static restore(snapshot: SessionSnapshot): Session {
    return new Session({ ...snapshot });
  }

  /** now < expiresAt. */
  isActiveAt(now: Date): boolean {
    return now.getTime() < this.state.expiresAt.getTime();
  }

  /** Emite SessionRevoked. */
  revoke(now: Date): void {
    this.record(new SessionRevoked(this.state.id.value, this.state.userId.value, now));
  }

  get id(): SessionId {
    return this.state.id;
  }
  get userId(): UserId {
    return this.state.userId;
  }
  get tokenDigest(): SessionTokenDigest {
    return this.state.tokenDigest;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get expiresAt(): Date {
    return this.state.expiresAt;
  }
  toSnapshot(): SessionSnapshot {
    return { ...this.state };
  }
}
