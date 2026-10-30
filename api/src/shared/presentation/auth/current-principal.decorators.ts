import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import type { AuthenticatedPrincipal } from './principal.js';

function principalOf(context: ExecutionContext): AuthenticatedPrincipal {
  const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  // Rota protegida sem principal é erro de programação (o guard global deveria ter barrado): 500, nunca dado alheio.
  if (!principal) throw new InvariantViolationError('Rota protegida executada sem principal autenticado.');
  return principal;
}

/** Id do usuário autenticado (dono dos dados financeiros). Nunca vem do corpo (RF23). */
export const CurrentOwnerId = createParamDecorator((_data: unknown, context: ExecutionContext) => principalOf(context).userId);

export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext) => principalOf(context));
