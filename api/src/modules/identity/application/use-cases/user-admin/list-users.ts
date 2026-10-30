import type { UserRepository } from '../../../domain/user/user.repository.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { Actor, AdminUserView } from '../../views.js';

export class ListUsers {
  constructor(private readonly users: UserRepository) {}

  /** O ator já foi revalidado pela leitura do principal (T16); sem transação nem lock. */
  async execute(_input: { actor: Actor }): Promise<AdminUserView[]> {
    return (await this.users.listManageable()).map(toAdminUserView);
  }
}
