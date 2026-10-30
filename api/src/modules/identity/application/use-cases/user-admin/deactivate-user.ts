import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { UserSessionsRevoked } from '../../../domain/session/events/session-events.js';
import { LastActiveAdminPolicy } from '../../../domain/user/last-active-admin.policy.js';
import { SelfTargetPolicy } from '../../../domain/user/self-target.policy.js';
import { User } from '../../../domain/user/user.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { Actor, AdminUserView } from '../../views.js';
import { loadManageable, parseTargetId, requireActiveAdmin } from './user-admin-support.js';

export class DeactivateUser {
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
      const actor = await requireActiveAdmin(tx, input.actor);
      const target = await loadManageable(tx.users, id);
      SelfTargetPolicy.assertNotSelf(actor.id, target.id);
      const before = User.restore(target.toSnapshot());
      if (!target.deactivate(now)) return { target, changed: false, revoked: 0 };
      LastActiveAdminPolicy.assertKeepsAnActiveAdmin(before, target, await tx.users.countActiveAdminsExcept(target.id));
      await tx.users.update(target);
      const revoked = await tx.sessions.deleteAllOfUser(target.id);
      return { target, changed: true, revoked };
    });

    if (outcome.changed) {
      const events = outcome.target.pullEvents();
      await this.publisher.publish(
        outcome.revoked > 0
          ? [...events, new UserSessionsRevoked(outcome.target.id.value, 'deactivated', outcome.revoked, now)]
          : events,
      );
      this.audit.userDeactivated({
        clientIp: input.actor.clientIp,
        at: now,
        actorId: input.actor.userId,
        userId: outcome.target.id.value,
        revokedSessions: outcome.revoked,
      });
    }
    return toAdminUserView(outcome.target);
  }
}
