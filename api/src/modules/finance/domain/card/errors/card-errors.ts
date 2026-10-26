import { AppError, type FieldViolation } from '@shared/domain/app-error.js';

export class CardValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly kind = 'validation' as const;

  constructor(fields: FieldViolation[]) {
    super('Dados do cartão inválidos.', { fields });
  }
}

export class CardNameTakenError extends AppError {
  readonly code = 'CARD_NAME_TAKEN';
  readonly kind = 'conflict' as const;

  constructor() {
    super('Já existe um cartão com este nome.', {
      fields: [{ field: 'name', code: 'NAME_TAKEN', message: 'Já existe um cartão com este nome.' }],
    });
  }
}
