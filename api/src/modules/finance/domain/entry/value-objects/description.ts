import { err, ok, type Result } from '@shared/domain/result.js';
import { codePointLength, normalizeText } from '../../text.js';

export type DescriptionViolation = 'REQUIRED' | 'TOO_LONG';

export class Description {
  static readonly MAX_LENGTH = 120;

  private constructor(readonly value: string) {}

  static create(raw: string): Result<Description, DescriptionViolation> {
    const value = normalizeText(raw);
    if (value.length === 0) return err('REQUIRED');
    if (codePointLength(value) > Description.MAX_LENGTH) return err('TOO_LONG');
    return ok(new Description(value));
  }
}
