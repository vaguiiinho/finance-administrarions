import type { AuthenticatedRequest } from '@shared/presentation/auth/authenticated-request.js';
import type { PrincipalCapability } from '@shared/presentation/auth/principal.js';

/** O que o guard leu dos decorators da rota. */
export interface AccessContext {
  request: AuthenticatedRequest;
  allowDuringPasswordChange: boolean;
  requiredCapability: PrincipalCapability | null;
}

/** Uma política de acesso; o guard as executa em ordem fixa (OCP: nova política sem editar o guard). */
export interface AccessPolicy {
  check(context: AccessContext): Promise<void>;
}

export const ACCESS_POLICIES = Symbol('ACCESS_POLICIES');
/** Políticas que rodam em TODAS as rotas casadas, inclusive `@Public()` (ex.: compatibilidade do cliente). */
export const ACCESS_PRE_POLICIES = Symbol('ACCESS_PRE_POLICIES');
