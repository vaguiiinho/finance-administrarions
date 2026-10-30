import { err, ok, type Result } from '@shared/domain/result.js';

/** Hex de 64 caracteres. O token em claro nunca é VO de domínio. */
export class SessionTokenDigest {
  private constructor(readonly value: string) {}
  static create(raw: string): Result<SessionTokenDigest, 'INVALID_FORMAT'> {
    return typeof raw === 'string' && /^[0-9a-f]{64}$/.test(raw) ? ok(new SessionTokenDigest(raw)) : err('INVALID_FORMAT');
  }
}
