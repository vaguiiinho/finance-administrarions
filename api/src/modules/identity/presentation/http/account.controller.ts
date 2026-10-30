import { Body, Controller, HttpCode, Inject, Put, UseGuards } from '@nestjs/common';
import { AllowDuringPasswordChange } from '@shared/presentation/auth/access-metadata.js';
import { ClientIp } from '@shared/presentation/auth/client-ip.decorator.js';
import { CurrentPrincipal } from '@shared/presentation/auth/current-principal.decorators.js';
import type { AuthenticatedPrincipal } from '@shared/presentation/auth/principal.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { ChangeOwnPassword } from '../../application/use-cases/account/change-own-password.js';
import { UpdateOwnProfile } from '../../application/use-cases/account/update-own-profile.js';
import { AuthQuotaGuard } from '../guards/auth-quota.guard.js';
import { presentCurrentUser } from './presenters/user.presenter.js';
import {
  changePasswordBodySchema,
  profileBodySchema,
  type ChangePasswordBody,
  type ProfileBody,
} from './schemas/identity.schemas.js';

@Controller('account')
export class AccountController {
  constructor(
    @Inject(ChangeOwnPassword) private readonly changeOwnPassword: ChangeOwnPassword,
    @Inject(UpdateOwnProfile) private readonly updateOwnProfile: UpdateOwnProfile,
  ) {}

  @AllowDuringPasswordChange()
  @UseGuards(AuthQuotaGuard)
  @Put('password')
  @HttpCode(200)
  async changePassword(
    @Body(new ZodValidationPipe(changePasswordBodySchema)) body: ChangePasswordBody,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @ClientIp() clientIp: string,
  ) {
    return presentCurrentUser(
      await this.changeOwnPassword.execute({ ...body, userId: principal.userId, sessionId: principal.sessionId, clientIp }),
    );
  }

  @Put('profile')
  @HttpCode(200)
  async updateProfile(
    @Body(new ZodValidationPipe(profileBodySchema)) body: ProfileBody,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return presentCurrentUser(await this.updateOwnProfile.execute({ userId: principal.userId, name: body.name }));
  }
}
