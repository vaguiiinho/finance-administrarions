import { extractBearerToken } from '@shared/presentation/auth/authenticated-request.js';
import type { AuthenticateSession } from '../../application/use-cases/auth/authenticate-session.js';
import { UnauthenticatedError } from '../../domain/user/errors/user-errors.js';
import type { AccessContext, AccessPolicy } from './access-policy.js';

/** 1. Autenticação: Bearer -> AuthenticateSession -> request.principal. Falha -> 401. */
export class AuthenticationPolicy implements AccessPolicy {
  constructor(private readonly authenticate: AuthenticateSession) {}

  async check({ request }: AccessContext): Promise<void> {
    const token = extractBearerToken(request);
    if (!token) throw new UnauthenticatedError();
    request.principal = await this.authenticate.execute({ token });
  }
}
