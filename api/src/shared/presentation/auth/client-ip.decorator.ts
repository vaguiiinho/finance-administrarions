import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** IP do cliente (`req.ip`; respeita `trust proxy` e o X-Forwarded-For repassado pelo BFF). */
export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => context.switchToHttp().getRequest<Request>().ip ?? 'unknown',
);
