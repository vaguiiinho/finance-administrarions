import type { UserRepository } from '../../../domain/user/user.repository.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { Actor, AdminUserView } from '../../views.js';
import { loadManageable, parseTargetId } from './user-admin-support.js';

export class GetUser {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { actor: Actor; id: string }): Promise<AdminUserView> {
    const id = parseTargetId(input.id);
    return toAdminUserView(await loadManageable(this.users, id));
  }
}
