import { codePointLength, normalizeLabel } from '@shared/domain/text.js';
import { err, ok, type Result } from '@shared/domain/result.js';

const MAX = 60;

/** NFC, trim, espaços colapsados; 1 a 60 code points (ADR 0005 3.1). Preserva a caixa digitada. */
export class UserName {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<UserName, 'REQUIRED' | 'TOO_LONG'> {
    const value = normalizeLabel(typeof raw === 'string' ? raw : '');
    if (value.length === 0) return err('REQUIRED');
    if (codePointLength(value) > MAX) return err('TOO_LONG');
    return ok(new UserName(value));
  }
}
