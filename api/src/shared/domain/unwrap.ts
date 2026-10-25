import { InvariantViolationError } from './app-error.js';
import type { Result } from './result.js';

/**
 * Para dados já persistidos (mappers): um valor inválido vindo do banco é erro de programação
 * ou de integridade, nunca erro de entrada do usuário.
 */
export function unwrapPersisted<T, E>(result: Result<T, E>, context: string): T {
  if (!result.ok) {
    throw new InvariantViolationError(`Dado persistido inválido (${context}): ${String(result.error)}`);
  }
  return result.value;
}
