import type { PrincipalCapability } from '@shared/presentation/auth/principal.js';
import type { Capability } from '../../domain/user/account-capabilities.js';
import { ForbiddenError } from '../../domain/user/errors/user-errors.js';
import type { AccessContext, AccessPolicy } from './access-policy.js';

/** S6: `PrincipalCapability` (shared) e `Capability` (domain) devem ser a mesma união; divergência quebra o typecheck. */
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const CAPABILITY_TYPES_IN_SYNC = true satisfies Equal<PrincipalCapability, Capability>;

/** 3. Capacidade: `@RequireCapability(cap)` com principal sem `cap` -> 403 FORBIDDEN. Roda antes do AuthQuotaGuard e dos pipes. */
export class CapabilityPolicy implements AccessPolicy {
  async check({ request, requiredCapability }: AccessContext): Promise<void> {
    if (!requiredCapability) return;
    if (!request.principal?.capabilities.includes(requiredCapability)) {
      throw new ForbiddenError();
    }
  }
}
