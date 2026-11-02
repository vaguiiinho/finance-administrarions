import type { AdminUserView, AuthResult, CurrentUserView } from '../../../application/views.js';

export const presentCurrentUser = (view: CurrentUserView) => ({
  id: view.id,
  name: view.name,
  email: view.email,
  role: view.role,
  mustChangePassword: view.mustChangePassword,
  accountKind: view.accountKind,
  capabilities: view.capabilities,
});

export const presentAuthResult = (result: AuthResult) => ({
  user: presentCurrentUser(result.user),
  session: { token: result.session.token, expiresAt: result.session.expiresAt.toISOString() },
});

export const presentAdminUser = (view: AdminUserView) => ({
  id: view.id,
  name: view.name,
  email: view.email,
  role: view.role,
  status: view.status,
  mustChangePassword: view.mustChangePassword,
  createdAt: view.createdAt.toISOString(),
});
