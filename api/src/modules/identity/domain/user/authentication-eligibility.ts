import type { UserKind, UserStatus } from './value-objects/user-status.js';

/** Quem pode autenticar (ADR 0011 3.3/S8): contas REGULAR e SHOWCASE ativas. Regra única, usada por User e pela autenticação de sessão. */
export const AuthenticationEligibility = {
  canAuthenticate(kind: UserKind, status: UserStatus): boolean {
    return (kind === 'REGULAR' || kind === 'SHOWCASE') && status === 'ACTIVE';
  },
};
