import type { Clock } from '@shared/application/ports/clock.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { User } from '../../../domain/user/user.js';
import type { UserRepository } from '../../../domain/user/user.repository.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';

export class EnsureDemoUser {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(_input: Record<string, never>): Promise<{ created: boolean }> {
    const id = unwrapPersisted(UserId.create(DEMO_USER_ID), 'DEMO_USER_ID');
    if (await this.users.findById(id)) return { created: false };
    await this.users.insert(User.demo({ now: this.clock.now() }));
    return { created: true };
  }
}
