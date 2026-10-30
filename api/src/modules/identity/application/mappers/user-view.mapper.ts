import type { User } from '../../domain/user/user.js';
import type { AdminUserView, CurrentUserView } from '../views.js';

export function toCurrentUserView(user: User): CurrentUserView {
  return {
    id: user.id.value,
    name: user.name.value,
    email: user.email.value,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export function toAdminUserView(user: User): AdminUserView {
  return {
    id: user.id.value,
    name: user.name.value,
    email: user.email.value,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
