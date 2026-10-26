import { AppError, type FieldViolation } from '@shared/domain/app-error.js';

export class EntryValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly kind = 'validation' as const;

  constructor(fields: FieldViolation[]) {
    super('Dados do lançamento inválidos.', { fields });
  }
}

export class IncomeNotPayableError extends AppError {
  readonly code = 'ENTRY_NOT_PAYABLE';
  readonly kind = 'business_rule' as const;

  constructor(incomeId: string) {
    super('Receitas não podem ser marcadas como pagas.', { incomeIds: [incomeId] });
  }
}

export class IncomesNotPayableError extends AppError {
  readonly code = 'ENTRIES_NOT_PAYABLE';
  readonly kind = 'business_rule' as const;

  constructor(incomeIds: string[]) {
    super('Receitas não podem ser marcadas como pagas.', { incomeIds });
  }
}
