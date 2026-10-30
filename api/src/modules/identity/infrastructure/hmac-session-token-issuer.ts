import { createHmac, randomBytes } from 'node:crypto';
import type { IssuedSessionToken, SessionTokenIssuer } from '../application/ports/session-token-issuer.js';
import { SessionTokenDigest } from '../domain/session/value-objects/session-token-digest.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** 32 bytes aleatórios em base64url + digest HMAC-SHA256 hex com a chave `secret`. */
export class HmacSessionTokenIssuer implements SessionTokenIssuer {
  constructor(private readonly secret: string) {}

  issue(): IssuedSessionToken {
    const token = randomBytes(32).toString('base64url');
    return { token, digest: this.compute(token) };
  }

  digest(token: string): SessionTokenDigest | null {
    return typeof token === 'string' && TOKEN_FORMAT.test(token) ? this.compute(token) : null;
  }

  private compute(token: string): SessionTokenDigest {
    const hex = createHmac('sha256', this.secret).update(token).digest('hex');
    return unwrapPersisted(SessionTokenDigest.create(hex), 'session digest');
  }
}
