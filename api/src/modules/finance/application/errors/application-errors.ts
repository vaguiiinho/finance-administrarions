import { AppError, type FieldViolation } from '@shared/domain/app-error.js';

/** Parâmetros de consulta/comando inválidos (formato, faixa, obrigatoriedade). */
export class InvalidQueryError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly kind = 'validation' as const;

  constructor(fields: FieldViolation[]) {
    super('Dados inválidos.', { fields });
  }
}

export class EntryNotFoundError extends AppError {
  readonly code = 'ENTRY_NOT_FOUND';
  readonly kind = 'not_found' as const;

  constructor(id: string) {
    super('Lançamento não encontrado.', { id });
  }
}

export class EntriesNotFoundError extends AppError {
  readonly code = 'ENTRIES_NOT_FOUND';
  readonly kind = 'not_found' as const;

  constructor(missingIds: string[]) {
    super('Lançamentos não encontrados.', { missingIds });
  }
}

export class CardNotFoundError extends AppError {
  readonly code = 'CARD_NOT_FOUND';
  readonly kind = 'not_found' as const;

  constructor(id: string) {
    super('Cartão não encontrado.', { id });
  }
}
