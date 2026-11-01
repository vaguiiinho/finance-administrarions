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

export class EntryNotEditableError extends AppError {
  readonly code = 'ENTRY_NOT_EDITABLE';
  readonly kind = 'business_rule' as const;

  constructor(id: string) {
    super('Somente despesas podem ser editadas.', { id });
  }
}

export class EntryNotDeletableError extends AppError {
  readonly code = 'ENTRY_NOT_DELETABLE';
  readonly kind = 'business_rule' as const;

  constructor(id: string) {
    super('Somente despesas podem ser excluídas.', { id });
  }
}

export class PaidCardExpenseDateLockedError extends AppError {
  readonly code = 'PAID_CARD_EXPENSE_DATE_LOCKED';
  readonly kind = 'business_rule' as const;

  constructor(id: string) {
    super('A data de uma despesa paga no cartão não pode ser alterada.', { id, field: 'date' });
  }
}
