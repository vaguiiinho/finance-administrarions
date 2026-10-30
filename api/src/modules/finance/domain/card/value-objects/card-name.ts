import { err, ok, type Result } from '@shared/domain/result.js';
import { codePointLength, labelKey, normalizeLabel } from '@shared/domain/text.js';

export type CardNameViolation = 'REQUIRED' | 'TOO_LONG';

export class CardName {
  static readonly MAX_LENGTH = 50;

  private constructor(readonly value: string) {}

  static create(raw: string): Result<CardName, CardNameViolation> {
    const value = normalizeLabel(raw);
    if (value.length === 0) return err('REQUIRED');
    if (codePointLength(value) > CardName.MAX_LENGTH) return err('TOO_LONG');
    return ok(new CardName(value));
  }

  /** Chave de unicidade: case-insensitive, acentos diferenciam (P18). */
  get key(): string {
    return labelKey(this.value);
  }

  equals(other: CardName): boolean {
    return this.key === other.key;
  }
}
