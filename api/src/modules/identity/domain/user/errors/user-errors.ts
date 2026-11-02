import { AppError, type FieldViolation } from '@shared/domain/app-error.js';

export class UserValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly kind = 'validation' as const;
  constructor(fields: FieldViolation[]) {
    super('Dados inválidos.', { fields });
  }
}

export class EmailTakenError extends AppError {
  readonly code = 'EMAIL_TAKEN';
  readonly kind = 'conflict' as const;
  constructor() {
    super('Este e-mail já está em uso.', {
      fields: [{ field: 'email', code: 'EMAIL_TAKEN', message: 'Este e-mail já está em uso.' }],
    });
  }
}

export class InvalidCredentialsError extends AppError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly kind = 'unauthenticated' as const;
  constructor() {
    super('E-mail ou senha inválidos.', null);
  }
}

export class UnauthenticatedError extends AppError {
  readonly code = 'UNAUTHENTICATED';
  readonly kind = 'unauthenticated' as const;
  constructor() {
    super('Sessão inválida ou expirada.', null);
  }
}

export class PasswordChangeRequiredError extends AppError {
  readonly code = 'PASSWORD_CHANGE_REQUIRED';
  readonly kind = 'forbidden' as const;
  constructor() {
    super('Defina uma nova senha para continuar.', null);
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly kind = 'forbidden' as const;
  /** `details` é sempre `{}` (ADR 0011 3.7/6.2), inclusive nas rotas de gestão. */
  constructor() {
    super('Você não tem permissão para esta ação.', {});
  }
}

export class UserNotFoundError extends AppError {
  readonly code = 'USER_NOT_FOUND';
  readonly kind = 'not_found' as const;
  constructor(id: string) {
    super('Usuário não encontrado.', { id });
  }
}

export class CannotTargetSelfError extends AppError {
  readonly code = 'CANNOT_TARGET_SELF';
  readonly kind = 'business_rule' as const;
  constructor() {
    super('Você não pode executar esta ação na sua própria conta.', null);
  }
}

export class LastAdminError extends AppError {
  readonly code = 'LAST_ADMIN';
  readonly kind = 'business_rule' as const;
  constructor() {
    super('É preciso manter pelo menos um administrador ativo.', null);
  }
}

export class TooManyAttemptsError extends AppError {
  readonly code = 'TOO_MANY_ATTEMPTS';
  readonly kind = 'rate_limited' as const;
  constructor(retryAfterSeconds: number) {
    super('Muitas tentativas. Tente novamente em instantes.', { retryAfterSeconds });
  }
}

/** Só no boot, nunca HTTP. `details` traz nomes de variáveis e códigos; nunca valores. */
export class FirstAdminConfigError extends AppError {
  readonly code = 'FIRST_ADMIN_CONFIG_INVALID';
  readonly kind = 'validation' as const;
  constructor(variables: { name: string; code: string }[]) {
    super('Configuração do primeiro administrador ausente ou inválida.', { variables });
  }
}

/** Só no boot, nunca HTTP. Nunca carrega o valor da senha. */
export class ShowcaseConfigError extends AppError {
  readonly code = 'SHOWCASE_CONFIG_INVALID';
  readonly kind = 'validation' as const;
  constructor(variable: string, reason: string) {
    super('Configuração da conta de demonstração inválida.', { variable, reason });
  }
}
