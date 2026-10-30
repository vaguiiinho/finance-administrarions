export interface CurrentUserView {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
  createdAt: Date;
}

export interface AuthResult {
  user: CurrentUserView;
  session: { token: string; expiresAt: Date };
}

export interface Actor {
  userId: string;
  clientIp: string;
}

/** Estruturalmente igual a `AuthenticatedPrincipal` (shared/presentation/auth); duplicado para a application não importar presentation. */
export interface PrincipalView {
  userId: string;
  sessionId: string;
  role: 'ADMIN' | 'USER';
  mustChangePassword: boolean;
}
