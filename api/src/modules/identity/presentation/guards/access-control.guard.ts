import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import {
  ALLOW_DURING_PASSWORD_CHANGE_KEY,
  IS_PUBLIC_KEY,
  REQUIRED_CAPABILITY_KEY,
} from '@shared/presentation/auth/access-metadata.js';
import type { AuthenticatedRequest } from '@shared/presentation/auth/authenticated-request.js';
import type { PrincipalCapability } from '@shared/presentation/auth/principal.js';
import type { AccessPolicy } from './access-policy.js';

/**
 * Único guard global (APP_GUARD): executa as políticas numa ordem fixa, em vez de vários guards cuja ordem dependeria
 * da ordem de registro. Seguro por padrão: rota sem decorator é protegida (ADR 0005 6.6).
 * `prePolicies` rodam em todas as rotas casadas (inclusive públicas); `policies`, só nas protegidas (ADR 0011 6.3).
 */
export class AccessControlGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prePolicies: readonly AccessPolicy[],
    private readonly policies: readonly AccessPolicy[],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const accessContext = {
      request: context.switchToHttp().getRequest<AuthenticatedRequest>(),
      allowDuringPasswordChange: this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE_KEY, targets) ?? false,
      requiredCapability: this.reflector.getAllAndOverride<PrincipalCapability>(REQUIRED_CAPABILITY_KEY, targets) ?? null,
    };
    for (const policy of this.prePolicies) await policy.check(accessContext);
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    for (const policy of this.policies) await policy.check(accessContext);
    return true;
  }
}
