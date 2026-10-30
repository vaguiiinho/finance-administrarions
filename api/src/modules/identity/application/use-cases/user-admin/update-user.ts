import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { EmailTakenError } from '../../../domain/user/errors/user-errors.js';
import { LastActiveAdminPolicy } from '../../../domain/user/last-active-admin.policy.js';
import { parseUserDetails } from '../../../domain/user/parse-user-details.js';
import { User } from '../../../domain/user/user.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { Actor, AdminUserView } from '../../views.js';
import { loadManageable, parseTargetId, requireActiveAdmin } from './user-admin-support.js';

export class UpdateUser {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    private readonly audit: IdentityAuditLog,
  ) {}

  async execute(input: { actor: Actor; id: string; name: unknown; email: unknown; role: unknown }): Promise<AdminUserView> {
    const id = parseTargetId(input.id);
    const details = parseUserDetails(input);
    const now = this.clock.now();

    const outcome = await this.uow.run(async (tx) => {
      await tx.lockAdminSet();
      await requireActiveAdmin(tx, input.actor);
      const target = await loadManageable(tx.users, id);
      const before = User.restore(target.toSnapshot());
      const changedFields = target.updateDetails(details, now);
      if (changedFields.length === 0) return { target, changedFields };

      if (before.isActiveAdmin() && !target.isActiveAdmin()) {
        LastActiveAdminPolicy.assertKeepsAnActiveAdmin(before, target, await tx.users.countActiveAdminsExcept(target.id));
      }
      if (changedFields.includes('email')) {
        const owner = await tx.users.findByEmail(details.email);
        if (owner && !owner.id.equals(target.id)) throw new EmailTakenError();
      }
      await tx.users.update(target);
      return { target, changedFields };
    });

    if (outcome.changedFields.length > 0) {
      await this.publisher.publish(outcome.target.pullEvents());
      this.audit.userUpdated({
        clientIp: input.actor.clientIp,
        at: now,
        actorId: input.actor.userId,
        userId: outcome.target.id.value,
        changedFields: [...outcome.changedFields],
      });
    }
    return toAdminUserView(outcome.target);
  }
}
