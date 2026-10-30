import { PasswordChangeRequiredError } from '../../domain/user/errors/user-errors.js';
import type { AccessContext, AccessPolicy } from './access-policy.js';

/** 2. Troca obrigatória de senha pendente bloqueia tudo que não esteja marcado `@AllowDuringPasswordChange()` (T13). */
export class PasswordChangePolicy implements AccessPolicy {
  async check({ request, allowDuringPasswordChange }: AccessContext): Promise<void> {
    if (request.principal?.mustChangePassword && !allowDuringPasswordChange) throw new PasswordChangeRequiredError();
  }
}
