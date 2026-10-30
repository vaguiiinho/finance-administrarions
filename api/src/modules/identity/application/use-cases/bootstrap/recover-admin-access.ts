import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { UserSessionsRevoked } from '../../../domain/session/events/session-events.js';
import { UserNotFoundError, UserValidationError } from '../../../domain/user/errors/user-errors.js';
import { EmailAddress } from '../../../domain/user/value-objects/email-address.js';
import { PlainPassword } from '../../../domain/user/value-objects/plain-password.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';

const MESSAGES = { REQUIRED: 'Campo obrigatório.', TOO_SHORT: 'Valor curto demais.', TOO_LONG: 'Valor longo demais.' } as const;

/** T15: só por CLI, nunca HTTP. Promove a ADMIN, reativa, redefine a senha (troca obrigatória) e encerra as sessões. */
export class RecoverAdminAccess {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    private readonly audit: IdentityAuditLog,
  ) {}

  async execute(input: { email: unknown; temporaryPassword: unknown }): Promise<{ userId: string }> {
    const rawEmail = typeof input.email === 'string' ? input.email : '';
    const password = PlainPassword.create(typeof input.temporaryPassword === 'string' ? input.temporaryPassword : '');
    if (!password.ok) {
      throw new UserValidationError([{ field: 'temporaryPassword', code: password.error, message: MESSAGES[password.error] }]);
    }
    const email = EmailAddress.create(rawEmail);
    const temporaryPasswordHash = await this.hasher.hash(password.value);
    const now = this.clock.now();

    const outcome = await this.uow.run(async (tx) => {
      await tx.lockAdminSet();
      const user = email.ok ? await tx.users.findByEmail(email.value) : null;
      if (!user || !user.isManageable()) throw new UserNotFoundError(rawEmail.trim().toLowerCase());
      user.updateDetails({ name: user.name, email: user.email, role: 'ADMIN' }, now);
      user.reactivate(now);
      user.resetPassword(temporaryPasswordHash, now);
      await tx.users.update(user);
      const revoked = await tx.sessions.deleteAllOfUser(user.id);
      return { user, revoked };
    });

    const events = outcome.user.pullEvents();
    await this.publisher.publish(
      outcome.revoked > 0
        ? [...events, new UserSessionsRevoked(outcome.user.id.value, 'password-reset', outcome.revoked, now)]
        : events,
    );
    this.audit.adminRecovered({ userId: outcome.user.id.value, at: now });
    return { userId: outcome.user.id.value };
  }
}
