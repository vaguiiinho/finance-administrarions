import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { Actor, AdminUserView } from '../../views.js';
import { loadManageable, parseTargetId, requireActiveAdmin } from './user-admin-support.js';

export class ReactivateUser {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    private readonly audit: IdentityAuditLog,
  ) {}

  async execute(input: { actor: Actor; id: string }): Promise<AdminUserView> {
    const id = parseTargetId(input.id);
    const now = this.clock.now();

    const outcome = await this.uow.run(async (tx) => {
      await tx.lockAdminSet();
      await requireActiveAdmin(tx, input.actor);
      const target = await loadManageable(tx.users, id);
      const changed = target.reactivate(now);
      if (changed) await tx.users.update(target);
      return { target, changed };
    });

    if (outcome.changed) {
      await this.publisher.publish(outcome.target.pullEvents());
      this.audit.userReactivated({
        clientIp: input.actor.clientIp,
        at: now,
        actorId: input.actor.userId,
        userId: outcome.target.id.value,
      });
    }
    return toAdminUserView(outcome.target);
  }
}
