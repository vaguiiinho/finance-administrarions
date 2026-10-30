export type PrincipalRole = 'ADMIN' | 'USER';

/** Escrito pelo AccessControlGuard (identity); lido pelos controllers (identity e finance). */
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  role: PrincipalRole;
  mustChangePassword: boolean;
}
