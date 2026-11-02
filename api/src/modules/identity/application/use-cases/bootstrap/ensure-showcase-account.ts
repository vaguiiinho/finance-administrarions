import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { UserSessionsRevoked } from '../../../domain/session/events/session-events.js';
import { ShowcaseConfigError } from '../../../domain/user/errors/user-errors.js';
import { ShowcaseAccount } from '../../../domain/user/showcase-account.js';
import { User } from '../../../domain/user/user.js';
import { EmailAddress } from '../../../domain/user/value-objects/email-address.js';
import { PlainPassword } from '../../../domain/user/value-objects/plain-password.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';

export type EnsureShowcaseStatus = 'created' | 'updated' | 'unchanged' | 'disabled' | 'absent' | 'conflict';

/** Provisiona/atualiza/desliga a conta de demonstração (ADR 0011 5.3). Chamado só pelo seed; nunca por HTTP. Idempotente. */
export class EnsureShowcaseAccount {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    /** Aviso operacional (seed); o valor da senha nunca entra na mensagem. */
    private readonly warn: (message: string) => void = () => undefined,
  ) {}

  async execute(input: { password: string | null }): Promise<{ status: EnsureShowcaseStatus }> {
    const password = this.parsePassword(input.password);
    const now = this.clock.now();
    const id = unwrapPersisted(UserId.create(ShowcaseAccount.id), 'SHOWCASE_USER_ID');
    const email = unwrapPersisted(EmailAddress.create(ShowcaseAccount.email), 'ShowcaseAccount.email');

    const outcome = await this.uow.run(async (tx) => {
      const existing = await tx.users.findById(id);

      if (password === null) {
        if (!existing) return { status: 'absent' as const, events: [] };
        if (!existing.deactivate(now)) return { status: 'disabled' as const, events: [] };
        await tx.users.update(existing);
        const revoked = await tx.sessions.deleteAllOfUser(id);
        return { status: 'disabled' as const, events: this.withRevoked(existing, revoked, now) };
      }

      if (!existing) {
        if (await tx.users.findByEmail(email)) return { status: 'conflict' as const, events: [] };
        const account = User.showcase({ passwordHash: await this.hasher.hash(password), now });
        await tx.users.insert(account);
        return { status: 'created' as const, events: account.pullEvents() };
      }

      // ADR 0011 5.3: conta INACTIVE nunca é reativada nem tem a senha trocada pelo seed.
      if (existing.status === 'INACTIVE') {
        this.warn('conta de demonstração está INACTIVE; senha configurada ignorada (reativação exige ação explícita).');
        return { status: 'unchanged' as const, events: [] };
      }

      if (await this.hasher.verify(password, existing.passwordHash)) return { status: 'unchanged' as const, events: [] };
      existing.replaceShowcasePassword(await this.hasher.hash(password), now);
      await tx.users.update(existing);
      const revoked = await tx.sessions.deleteAllOfUser(id);
      return { status: 'updated' as const, events: this.withRevoked(existing, revoked, now) };
    });

    await this.publisher.publish(outcome.events);
    return { status: outcome.status };
  }

  private parsePassword(raw: string | null): PlainPassword | null {
    if (raw === null || raw === '') return null;
    const parsed = PlainPassword.forShowcaseAccount(raw);
    if (!parsed.ok) throw new ShowcaseConfigError('SHOWCASE_ACCOUNT_PASSWORD', parsed.error);
    return parsed.value;
  }

  private withRevoked(user: User, revoked: number, now: Date) {
    const events = user.pullEvents();
    return revoked > 0 ? [...events, new UserSessionsRevoked(user.id.value, 'showcase-reconfigured', revoked, now)] : events;
  }
}
