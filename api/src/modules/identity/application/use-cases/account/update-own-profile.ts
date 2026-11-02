import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { AccountCapabilities } from '../../../domain/user/account-capabilities.js';
import { ForbiddenError, UnauthenticatedError, UserValidationError } from '../../../domain/user/errors/user-errors.js';
import type { UserRepository } from '../../../domain/user/user.repository.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import { UserName } from '../../../domain/user/value-objects/user-name.js';
import { toCurrentUserView } from '../../mappers/user-view.mapper.js';
import type { CurrentUserView } from '../../views.js';

export class UpdateOwnProfile {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(input: { userId: string; name: unknown }): Promise<CurrentUserView> {
    const id = UserId.create(input.userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    if (user && !AccountCapabilities.of(user).has('UPDATE_OWN_PROFILE')) throw new ForbiddenError();
    const name = UserName.create(typeof input.name === 'string' ? input.name : '');
    if (!name.ok) {
      const message = name.error === 'TOO_LONG' ? 'Valor longo demais.' : 'Campo obrigatório.';
      throw new UserValidationError([{ field: 'name', code: name.error, message }]);
    }
    if (!user) throw new UnauthenticatedError();
    if (user.rename(name.value, this.clock.now())) {
      await this.users.update(user);
      await this.publisher.publish(user.pullEvents());
    }
    return toCurrentUserView(user);
  }
}
