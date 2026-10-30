import { err, ok, type Result } from '@shared/domain/result.js';

/** Hash opaco (PHC). O domínio não sabe de algoritmo. */
export class PasswordHash {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<PasswordHash, 'INVALID_FORMAT'> {
    return typeof raw === 'string' && raw.length > 0 ? ok(new PasswordHash(raw)) : err('INVALID_FORMAT');
  }
}
