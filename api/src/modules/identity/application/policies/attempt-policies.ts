import type { AttemptScope } from '../ports/attempt-limiter.js';

/** ADR 0005 5.2: auth-ip 20 por 60 s; falhas por e-mail e por usuário: 5 por 15 min. */
export const ATTEMPT_POLICIES: Record<AttemptScope, { limit: number; windowSeconds: number }> = {
  'auth-ip': { limit: 20, windowSeconds: 60 },
  'login-email-failures': { limit: 5, windowSeconds: 15 * 60 },
  'password-change-user-failures': { limit: 5, windowSeconds: 15 * 60 },
};
