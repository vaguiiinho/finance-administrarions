import { err, ok, type Result } from '@shared/domain/result.js';
import { codePointLength, labelKey, normalizeLabel } from '../../text.js';

export type CategoryViolation = 'REQUIRED' | 'TOO_LONG';

export class Category {
  static readonly MAX_LENGTH = 50;

  private constructor(readonly value: string) {}

  static create(raw: string): Result<Category, CategoryViolation> {
    const value = normalizeLabel(raw);
    if (value.length === 0) return err('REQUIRED');
    if (codePointLength(value) > Category.MAX_LENGTH) return err('TOO_LONG');
    return ok(new Category(value));
  }

  /** Chave de comparação: case-insensitive, acentos diferenciam (P04). */
  get key(): string {
    return labelKey(this.value);
  }

  equals(other: Category): boolean {
    return this.key === other.key;
  }
}
