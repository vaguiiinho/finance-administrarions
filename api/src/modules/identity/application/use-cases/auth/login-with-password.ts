import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { Session } from '../../../domain/session/session.js';
import type { SessionRepository } from '../../../domain/session/session.repository.js';
import { SessionId } from '../../../domain/session/value-objects/session-id.js';
import { InvalidCredentialsError, TooManyAttemptsError, UserValidationError } from '../../../domain/user/errors/user-errors.js';
import type { UserRepository } from '../../../domain/user/user.repository.js';
import { EmailAddress } from '../../../domain/user/value-objects/email-address.js';
import { PlainPassword } from '../../../domain/user/value-objects/plain-password.js';
import { toCurrentUserView } from '../../mappers/user-view.mapper.js';
import type { AttemptKey, AttemptLimiter } from '../../ports/attempt-limiter.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';
import type { SessionTokenIssuer } from '../../ports/session-token-issuer.js';
import type { AuthResult } from '../../views.js';

export class LoginWithPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: SessionTokenIssuer,
    private readonly limiter: AttemptLimiter,
    private readonly audit: IdentityAuditLog,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(input: { email: unknown; password: unknown; clientIp: string }): Promise<AuthResult> {
    // D13: só presença e tipo geram 400; o resto cai em INVALID_CREDENTIALS.
    const violations = [];
    if (typeof input.email !== 'string' || input.email.trim() === '') {
      violations.push({ field: 'email', code: 'REQUIRED', message: 'Campo obrigatório.' });
    }
    if (typeof input.password !== 'string' || input.password === '') {
      violations.push({ field: 'password', code: 'REQUIRED', message: 'Campo obrigatório.' });
    }
    if (violations.length > 0) throw new UserValidationError(violations);
    const rawEmail = input.email as string;
    const rawPassword = input.password as string;

    const now = this.clock.now();
    const key: AttemptKey = { scope: 'login-email-failures', value: rawEmail.trim().toLowerCase() };
    const decision = await this.limiter.peek(key);
    if (!decision.allowed) {
      this.audit.rateLimited({ clientIp: input.clientIp, at: now, scope: key.scope, userId: null });
      throw new TooManyAttemptsError(decision.retryAfterSeconds);
    }

    const email = EmailAddress.create(rawEmail);
    const user = email.ok ? await this.users.findByEmail(email.value) : null;
    // RNF05: a verificação roda sempre; usuário inexistente, inativo, demo ou marcador caem no hash fictício.
    const verified = await this.hasher.verify(
      PlainPassword.forVerification(rawPassword),
      user?.canAuthenticate() ? user.passwordHash : null,
    );
    if (!user || !verified || !user.canAuthenticate()) {
      await this.limiter.recordFailure(key);
      this.audit.loginFailed({
        clientIp: input.clientIp,
        at: now,
        email: email.ok ? email.value : null,
        userId: user?.id.value ?? null,
      });
      throw new InvalidCredentialsError();
    }

    await this.limiter.reset(key);
    const { token, digest } = this.tokens.issue();
    const session = Session.open({
      id: unwrapPersisted(SessionId.create(this.ids.next()), 'sessionId'),
      userId: user.id,
      tokenDigest: digest,
      now,
    });
    await this.sessions.insert(session);
    this.audit.loginSucceeded({ clientIp: input.clientIp, at: now, userId: user.id.value });
    await this.publisher.publish(session.pullEvents());
    return { user: toCurrentUserView(user), session: { token, expiresAt: session.expiresAt } };
  }
}
