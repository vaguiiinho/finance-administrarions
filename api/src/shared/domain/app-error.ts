export type ErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'business_rule'
  | 'unauthenticated'
  | 'forbidden'
  | 'rate_limited'
  | 'upgrade_required';

export interface FieldViolation {
  field: string;
  code: string;
  message: string;
}

/** Erro previsto do sistema. O `kind` é mapeado para HTTP na camada de apresentação. */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly kind: ErrorKind;

  protected constructor(
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Violação de invariante por erro de programação (vira 500, nunca é mapeada como erro de entrada). */
export class InvariantViolationError extends Error {
  readonly code = 'INTERNAL_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolationError';
  }
}
