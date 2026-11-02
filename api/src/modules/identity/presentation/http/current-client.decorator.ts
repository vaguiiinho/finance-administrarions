import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { ClientRequest } from '../guards/client-context.policy.js';

/** Cliente identificado pela pré-política (`X-Client`). Sempre presente em rotas casadas. */
export const CurrentClient = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const client = context.switchToHttp().getRequest<ClientRequest>().client;
  if (!client) throw new InvariantViolationError('Rota executada sem cliente identificado.');
  return client;
});
