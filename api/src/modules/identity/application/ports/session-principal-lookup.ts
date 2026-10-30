import type { SessionTokenDigest } from '../../domain/session/value-objects/session-token-digest.js';

export interface SessionPrincipalRecord {
  sessionId: string;
  userId: string;
  kind: 'REGULAR' | 'DEMO' | 'PENDING_FIRST_ADMIN';
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
}

/** Leitura por requisição (T16): uma consulta sessions JOIN users, sem cache. */
export interface SessionPrincipalLookup {
  findByDigest(digest: SessionTokenDigest, now: Date): Promise<SessionPrincipalRecord | null>;
}
export const SESSION_PRINCIPAL_LOOKUP = Symbol('SESSION_PRINCIPAL_LOOKUP');
