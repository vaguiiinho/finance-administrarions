import { codePointLength } from '@shared/domain/text.js';
import { err, ok, type Result } from '@shared/domain/result.js';

const MIN = 8;
const MAX = 72;
const VERIFY_LIMIT = 1024;
const REDACTED = '[REDACTED]';

/** 8 a 72 code points, sem trim. `reveal()` é o único acesso; toString/toJSON mascarados (ADR 0005 3.1, RNF01). */
export class PlainPassword {
  readonly #secret: string;

  private constructor(secret: string) {
    this.#secret = secret;
  }

  static create(raw: string): Result<PlainPassword, 'REQUIRED' | 'TOO_SHORT' | 'TOO_LONG'> {
    if (typeof raw !== 'string' || raw.length === 0) return err('REQUIRED');
    const length = codePointLength(raw);
    if (length < MIN) return err('TOO_SHORT');
    if (length > MAX) return err('TOO_LONG');
    return ok(new PlainPassword(raw));
  }

  /**
   * Para CONFERIR uma senha já existente (login, senha atual): as regras de tamanho só valem ao DEFINIR (D13).
   * Limita o tamanho para não custar CPU com entradas absurdas.
   */
  static forVerification(raw: string): PlainPassword {
    return new PlainPassword(raw.slice(0, VERIFY_LIMIT));
  }

  reveal(): string {
    return this.#secret;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }
}
