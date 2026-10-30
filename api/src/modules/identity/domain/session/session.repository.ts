import type { UserId } from '../user/value-objects/user-id.js';
import type { Session } from './session.js';
import type { SessionId } from './value-objects/session-id.js';
import type { SessionTokenDigest } from './value-objects/session-token-digest.js';

export interface SessionRepository {
  insert(session: Session): Promise<void>;
  findActiveByDigest(digest: SessionTokenDigest, now: Date): Promise<Session | null>;
  delete(id: SessionId): Promise<void>;
  /** Inativação e redefinição. Devolve quantas. */
  deleteAllOfUser(userId: UserId): Promise<number>;
  /** Troca da própria senha: mantém a sessão atual. */
  deleteAllOfUserExcept(userId: UserId, keep: SessionId): Promise<number>;
  deleteExpired(now: Date): Promise<number>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
