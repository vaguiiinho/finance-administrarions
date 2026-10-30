import { UnauthenticatedError } from '../../../domain/user/errors/user-errors.js';
import type { UserRepository } from '../../../domain/user/user.repository.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import { toCurrentUserView } from '../../mappers/user-view.mapper.js';
import type { CurrentUserView } from '../../views.js';

export class GetCurrentUser {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { userId: string }): Promise<CurrentUserView> {
    const id = UserId.create(input.userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    if (!user) throw new UnauthenticatedError();
    return toCurrentUserView(user);
  }
}
