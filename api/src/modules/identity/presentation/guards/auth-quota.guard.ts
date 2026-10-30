import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CheckAuthRequestQuota } from '../../application/use-cases/auth/check-auth-request-quota.js';

/** Limite por IP nas rotas de login e troca de senha (RNF04); roda antes da validação do corpo. */
@Injectable()
export class AuthQuotaGuard implements CanActivate {
  constructor(@Inject(CheckAuthRequestQuota) private readonly quota: CheckAuthRequestQuota) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    await this.quota.execute({ clientIp: request.ip ?? 'unknown' });
    return true;
  }
}
