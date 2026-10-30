import { ForbiddenError } from '../../domain/user/errors/user-errors.js';
import type { AccessContext, AccessPolicy } from './access-policy.js';

/** 3. Nível: `@RequireRole('ADMIN')` com principal de outro nível -> 403 FORBIDDEN. */
export class RolePolicy implements AccessPolicy {
  async check({ request, requiredRole }: AccessContext): Promise<void> {
    if (requiredRole && request.principal?.role !== requiredRole) throw new ForbiddenError();
  }
}
