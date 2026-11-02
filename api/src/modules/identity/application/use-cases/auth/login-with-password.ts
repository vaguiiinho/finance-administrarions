import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { ClientDescriptor } from '../../../domain/client/client-descriptor.js';
import { Session } from '../../../domain/session/session.js';
import type { SessionRepository } from '../../../domain/session/session.repository.js';
import { SessionId } from '../../../domain/session/value-objects/session-id.js';
import { InvalidCredentialsError, TooManyAttemptsError, UserValidationError } from '../../../domain/user/errors/user-errors.js';
import type { UserRepository } from '../../../domain/user/user.repository.js';
import { EmailAddress } from '../../../domain/user/value-objects/email-address.js';
import { PlainPassword } from '../../../domain/user/value-objects/plain-password.js';
import { toCurrentUserView } from '../../mappers/user-view.mapper.js';
import type { AttemptKey, AttemptLimiter } from '../../ports/attempt-limiter.js';
import type { ClientAuditInfo, IdentityAuditLog } from '../../ports/identity-audit-log.js';
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

  async execute(input: { email: unknown; password: unknown; clientIp: string; client?: ClientDescriptor }): Promise<AuthResult> {
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
    // Ausente = WEB (o web não envia X-Client).
    const client: ClientAuditInfo = {
      kind: input.client?.kind ?? 'WEB',
      appVersion: input.client?.appVersion?.toString() ?? null,
    };
    const key: AttemptKey = { scope: 'login-email-failures', value: rawEmail.trim().toLowerCase() };
    const email = EmailAddress.create(rawEmail);
    const user = email.ok ? await this.users.findByEmail(email.value) : null;
    // O lookup vem antes do `peek` de propósito: a isenção vale só para a conta SHOWCASE, que só se conhece após buscar
    // o usuário. O custo extra de leitura é limitado pelo `AuthQuotaGuard` (cota por IP).
    // ADR 0011 3.4: a senha da conta de demonstração é pública; o bloqueio por e-mail só serviria para negar acesso.
    // A isenção vale só para o usuário de fato SHOWCASE (um REGULAR com o e-mail reservado continua bloqueado).
    const limitedByEmail = user?.kind !== 'SHOWCASE';
    const decision = limitedByEmail ? await this.limiter.peek(key) : { allowed: true as const };
    if (!decision.allowed) {
      this.audit.rateLimited({ clientIp: input.clientIp, at: now, scope: key.scope, userId: null });
      throw new TooManyAttemptsError(decision.retryAfterSeconds);
    }

    // RNF05: a verificação roda sempre; usuário inexistente, inativo, demo ou marcador caem no hash fictício.
    const verified = await this.hasher.verify(
      PlainPassword.forVerification(rawPassword),
      user?.canAuthenticate() ? user.passwordHash : null,
    );
    if (!user || !verified || !user.canAuthenticate()) {
      if (limitedByEmail) await this.limiter.recordFailure(key);
      this.audit.loginFailed({
        clientIp: input.clientIp,
        at: now,
        email: email.ok ? email.value : null,
        userId: user?.id.value ?? null,
        client,
      });
      throw new InvalidCredentialsError();
    }

    if (limitedByEmail) await this.limiter.reset(key);
    const { token, digest } = this.tokens.issue();
    const session = Session.open({
      id: unwrapPersisted(SessionId.create(this.ids.next()), 'sessionId'),
      userId: user.id,
      tokenDigest: digest,
      now,
    });
    await this.sessions.insert(session);
    this.audit.loginSucceeded({ clientIp: input.clientIp, at: now, userId: user.id.value, client });
    await this.publisher.publish(session.pullEvents());
    return { user: toCurrentUserView(user), session: { token, expiresAt: session.expiresAt } };
  }
}
