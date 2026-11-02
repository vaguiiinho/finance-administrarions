import type { Request } from 'express';
import { RequestValidationError } from '@shared/presentation/errors/request-validation.error.js';
import type { CheckClientCompatibility } from '../../application/use-cases/auth/check-client-compatibility.js';
import { parseClientHeader, type ClientDescriptor } from '../../domain/client/client-descriptor.js';
import type { AccessContext, AccessPolicy } from './access-policy.js';

export type ClientRequest = Request & { client?: ClientDescriptor };

/** Pré-política: lê `X-Client` (400 se malformado), guarda em `request.client` e aplica a versão mínima (426). */
export class ClientContextPolicy implements AccessPolicy {
  constructor(private readonly compatibility: CheckClientCompatibility) {}

  async check({ request }: AccessContext): Promise<void> {
    const parsed = parseClientHeader(request.header('X-Client'));
    if (!parsed.ok) {
      throw new RequestValidationError([
        { field: 'header.X-Client', code: 'INVALID_FORMAT', message: 'Cabeçalho X-Client em formato inválido.' },
      ]);
    }
    (request as ClientRequest).client = parsed.value;
    this.compatibility.execute({ client: parsed.value });
  }
}
