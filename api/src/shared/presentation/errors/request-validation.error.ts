import { AppError, type FieldViolation } from '@shared/domain/app-error.js';

/** Forma da requisição inválida (tipo, chaves desconhecidas, tamanho de array) detectada pelo zod. */
export class RequestValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly kind = 'validation' as const;

  constructor(fields: FieldViolation[]) {
    super('Dados inválidos.', { fields });
  }
}
