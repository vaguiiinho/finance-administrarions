import type { FieldViolation } from '@shared/domain/app-error.js';
import type { Result } from '@shared/domain/result.js';
import { EmailAddress } from './value-objects/email-address.js';

export const MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  TOO_LONG: 'Valor longo demais.',
  TOO_SHORT: 'Valor curto demais.',
  INVALID_FORMAT: 'Formato inválido.',
  INVALID_VALUE: 'Valor inválido.',
};

/** E-mail digitado por uma pessoa: o TLD reservado (`.invalid`: demo, conta de demonstração, marcador) é INVALID_FORMAT. */
export function collectEmail(violations: FieldViolation[], field: string, raw: string): EmailAddress | undefined {
  const email = collect(violations, field, EmailAddress.create(raw));
  if (email?.isReserved()) {
    violations.push({ field, code: 'INVALID_FORMAT', message: MESSAGES.INVALID_FORMAT! });
    return undefined;
  }
  return email;
}

/** Devolve o valor se ok; senão registra a violação (sem eco do valor) e devolve undefined. */
export function collect<T>(violations: FieldViolation[], field: string, result: Result<T, string>): T | undefined {
  if (result.ok) return result.value;
  violations.push({ field, code: result.error, message: MESSAGES[result.error] ?? 'Valor inválido.' });
  return undefined;
}
