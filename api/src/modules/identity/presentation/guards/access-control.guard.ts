import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import {
  ALLOW_DURING_PASSWORD_CHANGE_KEY,
  IS_PUBLIC_KEY,
  REQUIRED_ROLE_KEY,
} from '@shared/presentation/auth/access-metadata.js';
import type { AuthenticatedRequest } from '@shared/presentation/auth/authenticated-request.js';
import type { PrincipalRole } from '@shared/presentation/auth/principal.js';
import type { AccessPolicy } from './access-policy.js';

/**
 * Único guard global (APP_GUARD): executa as políticas numa ordem fixa, em vez de vários guards cuja ordem dependeria
 * da ordem de registro. Seguro por padrão: rota sem decorator é protegida (ADR 0005 6.6).
 */
export class AccessControlGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policies: readonly AccessPolicy[],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const accessContext = {
      request: context.switchToHttp().getRequest<AuthenticatedRequest>(),
      allowDuringPasswordChange: this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE_KEY, targets) ?? false,
      requiredRole: this.reflector.getAllAndOverride<PrincipalRole>(REQUIRED_ROLE_KEY, targets) ?? null,
    };
    for (const policy of this.policies) await policy.check(accessContext);
    return true;
  }
}
