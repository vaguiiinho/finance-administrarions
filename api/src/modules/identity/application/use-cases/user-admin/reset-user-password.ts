import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { UserSessionsRevoked } from '../../../domain/session/events/session-events.js';
import { UserValidationError } from '../../../domain/user/errors/user-errors.js';
import { SelfTargetPolicy } from '../../../domain/user/self-target.policy.js';
import { PlainPassword } from '../../../domain/user/value-objects/plain-password.js';
import { toAdminUserView } from '../../mappers/user-view.mapper.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';
import type { Actor, AdminUserView } from '../../views.js';
import { loadManageable, parseTargetId, requireActiveAdmin } from './user-admin-support.js';

const MESSAGES = { REQUIRED: 'Campo obrigatório.', TOO_SHORT: 'Valor curto demais.', TOO_LONG: 'Valor longo demais.' } as const;

export class ResetUserPassword {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    private readonly audit: IdentityAuditLog,
  ) {}

  async execute(input: { actor: Actor; id: string; password: unknown }): Promise<AdminUserView> {
    const id = parseTargetId(input.id);
    const password = PlainPassword.create(typeof input.password === 'string' ? input.password : '');
    if (!password.ok) {
      throw new UserValidationError([{ field: 'password', code: password.error, message: MESSAGES[password.error] }]);
    }
    // argon2 fora da transação e do lock (ADR 5.4).
    const temporaryPasswordHash = await this.hasher.hash(password.value);
    const now = this.clock.now();

    const outcome = await this.uow.run(async (tx) => {
      await tx.lockAdminSet();
      const actor = await requireActiveAdmin(tx, input.actor);
      const target = await loadManageable(tx.users, id);
      SelfTargetPolicy.assertNotSelf(actor.id, target.id);
      target.resetPassword(temporaryPasswordHash, now);
      await tx.users.update(target);
      const revoked = await tx.sessions.deleteAllOfUser(target.id);
      return { target, revoked };
    });

    const events = outcome.target.pullEvents();
    await this.publisher.publish(
      outcome.revoked > 0
        ? [...events, new UserSessionsRevoked(outcome.target.id.value, 'password-reset', outcome.revoked, now)]
        : events,
    );
    this.audit.userPasswordReset({
      clientIp: input.actor.clientIp,
      at: now,
      actorId: input.actor.userId,
      userId: outcome.target.id.value,
      revokedSessions: outcome.revoked,
    });
    return toAdminUserView(outcome.target);
  }
}
