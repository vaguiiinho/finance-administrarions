export type AttemptScope = 'auth-ip' | 'login-email-failures' | 'password-change-user-failures';
export interface AttemptKey {
  scope: AttemptScope;
  value: string;
}
export type AttemptDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface AttemptLimiter {
  /** Conta uma requisição (auth-ip). */
  consume(key: AttemptKey): Promise<AttemptDecision>;
  /** Consulta sem contar: bloqueado quando as falhas na janela já atingiram o limite. */
  peek(key: AttemptKey): Promise<AttemptDecision>;
  recordFailure(key: AttemptKey): Promise<void>;
  reset(key: AttemptKey): Promise<void>;
}
export const ATTEMPT_LIMITER = Symbol('ATTEMPT_LIMITER');
