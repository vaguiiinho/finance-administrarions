export type PrincipalRole = 'ADMIN' | 'USER';
export type PrincipalCapability = 'MANAGE_USERS' | 'MANAGE_EXPENSES' | 'CHANGE_OWN_PASSWORD' | 'UPDATE_OWN_PROFILE';

/** Escrito pelo AccessControlGuard (identity); lido pelos controllers (identity e finance). */
export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  role: PrincipalRole;
  mustChangePassword: boolean;
  capabilities: readonly PrincipalCapability[];
}
