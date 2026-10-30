import type { Clock } from '@shared/application/ports/clock.js';
import { TooManyAttemptsError } from '../../../domain/user/errors/user-errors.js';
import type { AttemptLimiter } from '../../ports/attempt-limiter.js';
import type { IdentityAuditLog } from '../../ports/identity-audit-log.js';

export class CheckAuthRequestQuota {
  constructor(
    private readonly limiter: AttemptLimiter,
    private readonly audit: IdentityAuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(input: { clientIp: string }): Promise<void> {
    const decision = await this.limiter.consume({ scope: 'auth-ip', value: input.clientIp });
    if (decision.allowed) return;
    this.audit.rateLimited({ clientIp: input.clientIp, at: this.clock.now(), scope: 'auth-ip', userId: null });
    throw new TooManyAttemptsError(decision.retryAfterSeconds);
  }
}
