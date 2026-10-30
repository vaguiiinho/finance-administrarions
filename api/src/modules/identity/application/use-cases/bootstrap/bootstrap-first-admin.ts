import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import { parseFirstAdminConfig, type FirstAdminEnv } from '../../../domain/user/parse-first-admin-config.js';
import { User } from '../../../domain/user/user.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work.js';
import type { PasswordHasher } from '../../ports/password-hasher.js';

export class BootstrapFirstAdmin {
  constructor(
    private readonly uow: IdentityUnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
    private readonly audit: IdentityAuditLog,
  ) {}

  async execute(env: FirstAdminEnv): Promise<{ status: 'skipped' | 'created' | 'provisioned' }> {
    const now = this.clock.now();
    const result = await this.uow.run(async (tx) => {
      await tx.lockFirstAdminBootstrap();
      // CA12/CA13: com qualquer usuário REGULAR a inicialização é ignorada, sem validar as variáveis.
      if ((await tx.users.countRegular()) > 0) return { status: 'skipped' as const };

      const config = parseFirstAdminConfig(env);
      // A decisão depende da contagem sob lock; o custo único do argon2 no boot é aceitável (ADR 5.7).
      const temporaryPasswordHash = await this.hasher.hash(config.password);
      const existing = await tx.users.findById(unwrapPersisted(UserId.create(FIRST_ADMIN_ID), 'FIRST_ADMIN_ID'));

      if (existing === null) {
        const admin = User.firstAdmin({ name: config.name, email: config.email, temporaryPasswordHash, now });
        await tx.users.insert(admin);
        return { status: 'created' as const, user: admin };
      }
      if (existing.kind !== 'PENDING_FIRST_ADMIN') {
        throw new InvariantViolationError('FIRST_ADMIN_ID ocupado por um usuário que não é o marcador.');
      }
      existing.provisionFirstAdmin({ name: config.name, email: config.email, temporaryPasswordHash, now });
      await tx.users.update(existing);
      return { status: 'provisioned' as const, user: existing };
    });

    if (result.status === 'skipped') return { status: 'skipped' };
    await this.publisher.publish(result.user.pullEvents());
    this.audit.firstAdminBootstrapped({
      userId: result.user.id.value,
      receivedLegacyData: result.status === 'provisioned',
      at: now,
    });
    return { status: result.status };
  }
}
