import type { Clock } from '@shared/application/ports/clock.js';
import { UnauthenticatedError } from '../../../domain/user/errors/user-errors.js';
import type { SessionPrincipalLookup } from '../../ports/session-principal-lookup.js';
import type { SessionTokenIssuer } from '../../ports/session-token-issuer.js';
import type { PrincipalView } from '../../views.js';

export class AuthenticateSession {
  constructor(
    private readonly tokens: SessionTokenIssuer,
    private readonly lookup: SessionPrincipalLookup,
    private readonly clock: Clock,
  ) {}

  /** T16: nível, situação e troca obrigatória lidos do banco a cada chamada, sem cache. */
  async execute(input: { token: string }): Promise<PrincipalView> {
    const digest = this.tokens.digest(input.token);
    if (!digest) throw new UnauthenticatedError();
    const record = await this.lookup.findByDigest(digest, this.clock.now());
    if (!record || record.kind !== 'REGULAR' || record.status !== 'ACTIVE') throw new UnauthenticatedError();
    return {
      userId: record.userId,
      sessionId: record.sessionId,
      role: record.role,
      mustChangePassword: record.mustChangePassword,
    };
  }
}
