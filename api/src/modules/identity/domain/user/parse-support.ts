import type { FieldViolation } from '@shared/domain/app-error.js';
import type { Result } from '@shared/domain/result.js';

export const MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  TOO_LONG: 'Valor longo demais.',
  TOO_SHORT: 'Valor curto demais.',
  INVALID_FORMAT: 'Formato inválido.',
  INVALID_VALUE: 'Valor inválido.',
};

/** Devolve o valor se ok; senão registra a violação (sem eco do valor) e devolve undefined. */
export function collect<T>(violations: FieldViolation[], field: string, result: Result<T, string>): T | undefined {
  if (result.ok) return result.value;
  violations.push({ field, code: result.error, message: MESSAGES[result.error] ?? 'Valor inválido.' });
  return undefined;
}
