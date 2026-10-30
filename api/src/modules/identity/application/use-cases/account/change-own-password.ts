import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { FieldViolation } from '@shared/domain/app-error.js';
import { UserSessionsRevoked } from '../../../domain/session/events/session-events.js';
import { SessionId } from '../../../domain/session/value-objects/session-id.js';
import {
  TooManyAttemptsError,
  UnauthenticatedError,
  UserValidationError,
} from '../../../domain/user/errors/user-errors.js';
import { PlainPassword } from '../../../domain/user/value-objects/plain-password.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import { toCurrentUserView } from '../../mappers/user-view.mapper.js';
import type { AttemptKey, AttemptLimiter } from '../../ports/attempt-limiter.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';
import type { CurrentUserView } from '../../views.js';

const REQUIRED = 'Campo obrigatório.';
const NEW_PASSWORD_MESSAGES = {
  REQUIRED,
  TOO_SHORT: 'Valor curto demais.',
  TOO_LONG: 'Valor longo demais.',
} as const;

export class ChangeOwnPassword {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly limiter: AttemptLimiter,
    private readonly audit: IdentityAuditLog,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    userId: string;
    sessionId: string;
    currentPassword: unknown;
    newPassword: unknown;
    clientIp: string;
  }): Promise<CurrentUserView> {
    const violations: FieldViolation[] = [];
    if (typeof input.currentPassword !== 'string' || input.currentPassword === '') {
      violations.push({ field: 'currentPassword', code: 'REQUIRED', message: REQUIRED });
    }
    const next = PlainPassword.create(typeof input.newPassword === 'string' ? input.newPassword : '');
    if (!next.ok) violations.push({ field: 'newPassword', code: next.error, message: NEW_PASSWORD_MESSAGES[next.error] });
    if (violations.length > 0 || !next.ok) throw new UserValidationError(violations);
    const currentRaw = input.currentPassword as string;

    const userId = UserId.create(input.userId);
    const sessionId = SessionId.create(input.sessionId);
    if (!userId.ok || !sessionId.ok) throw new UnauthenticatedError();

    const now = this.clock.now();
    const key: AttemptKey = { scope: 'password-change-user-failures', value: userId.value.value };
    const decision = await this.limiter.peek(key);
    if (!decision.allowed) {
      this.audit.rateLimited({ clientIp: input.clientIp, at: now, scope: key.scope, userId: userId.value.value });
      throw new TooManyAttemptsError(decision.retryAfterSeconds);
    }

    const outcome = await this.uow.run(async (tx) => {
      const user = await tx.users.findById(userId.value);
      if (!user || !user.canAuthenticate()) throw new UnauthenticatedError();
      const matches = await this.hasher.verify(PlainPassword.forVerification(currentRaw), user.passwordHash);
      if (!matches) {
        await this.limiter.recordFailure(key);
        throw new UserValidationError([{ field: 'currentPassword', code: 'INCORRECT', message: 'Senha atual incorreta.' }]);
      }
      if (currentRaw === next.value.reveal()) {
        throw new UserValidationError([
          { field: 'newPassword', code: 'SAME_AS_CURRENT', message: 'A nova senha deve ser diferente da atual.' },
        ]);
      }
      user.changePassword(await this.hasher.hash(next.value), now);
      await tx.users.update(user);
      const revoked = await tx.sessions.deleteAllOfUserExcept(user.id, sessionId.value);
      return { user, revoked };
    });

    await this.limiter.reset(key);
    this.audit.passwordChanged({ clientIp: input.clientIp, at: now, userId: outcome.user.id.value });
    const events = outcome.user.pullEvents();
    const published = outcome.revoked > 0
      ? [...events, new UserSessionsRevoked(outcome.user.id.value, 'password-changed', outcome.revoked, now)]
      : events;
    await this.publisher.publish(published);
    return toCurrentUserView(outcome.user);
  }
}
