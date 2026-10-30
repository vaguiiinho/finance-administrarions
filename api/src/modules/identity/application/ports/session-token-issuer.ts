import type { SessionTokenDigest } from '../../domain/session/value-objects/session-token-digest.js';

export interface IssuedSessionToken {
  token: string;
  digest: SessionTokenDigest;
}
export interface SessionTokenIssuer {
  issue(): IssuedSessionToken;
  /** null se o formato for inválido. */
  digest(token: string): SessionTokenDigest | null;
}
export const SESSION_TOKEN_ISSUER = Symbol('SESSION_TOKEN_ISSUER');
