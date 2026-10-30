import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { EmailTakenError } from '../../../domain/user/errors/user-errors.js';
import { parseNewUser } from '../../../domain/user/parse-new-user.js';
import { User } from '../../../domain/user/user.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';
import type { Actor, AdminUserView } from '../../views.js';
import { requireActiveAdmin } from './user-admin-support.js';

export class CreateUser {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    private readonly audit: IdentityAuditLog,
  ) {}

  async execute(input: { actor: Actor; name: unknown; email: unknown; role: unknown; password: unknown }): Promise<AdminUserView> {
    const parsed = parseNewUser(input);
    // argon2 fora da transação e do lock (ADR 5.4).
    const temporaryPasswordHash = await this.hasher.hash(parsed.password);
    const now = this.clock.now();

    const user = await this.uow.run(async (tx) => {
      await tx.lockAdminSet();
      await requireActiveAdmin(tx, input.actor);
      if (await tx.users.findByEmail(parsed.email)) throw new EmailTakenError();
      const created = User.create({
        id: unwrapPersisted(UserId.create(this.ids.next()), 'userId'),
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        temporaryPasswordHash,
        now,
      });
      await tx.users.insert(created);
      return created;
    });

    await this.publisher.publish(user.pullEvents());
    this.audit.userCreated({
      clientIp: input.actor.clientIp,
      at: now,
      actorId: input.actor.userId,
      userId: user.id.value,
      role: user.role,
    });
    return toAdminUserView(user);
  }
}
