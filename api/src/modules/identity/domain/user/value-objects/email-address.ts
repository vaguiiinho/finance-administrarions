import { codePointLength } from '@shared/domain/text.js';
import { err, ok, type Result } from '@shared/domain/result.js';

const MAX = 254;
const MAX_LOCAL = 64;

/** trim + minúsculas; até 254 code points; formato pragmático (ADR 0005 3.1). */
export class EmailAddress {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<EmailAddress, 'REQUIRED' | 'INVALID_FORMAT' | 'TOO_LONG'> {
    const value = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
    if (value.length === 0) return err('REQUIRED');
    if (codePointLength(value) > MAX) return err('TOO_LONG');
    if (/\s/.test(value)) return err('INVALID_FORMAT');
    const parts = value.split('@');
    if (parts.length !== 2) return err('INVALID_FORMAT');
    const [local, domain] = parts as [string, string];
    if (local.length === 0 || codePointLength(local) > MAX_LOCAL) return err('INVALID_FORMAT');
    const labels = domain.split('.');
    if (labels.length < 2 || labels.some((label) => label.length === 0)) return err('INVALID_FORMAT');
    return ok(new EmailAddress(value));
  }

  /** TLD `.invalid` (demo e marcador do primeiro administrador). */
  isReserved(): boolean {
    return this.value.endsWith('.invalid');
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }
}
