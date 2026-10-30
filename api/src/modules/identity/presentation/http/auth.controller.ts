import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AllowDuringPasswordChange, Public } from '@shared/presentation/auth/access-metadata.js';
import { extractBearerToken, type AuthenticatedRequest } from '@shared/presentation/auth/authenticated-request.js';
import { ClientIp } from '@shared/presentation/auth/client-ip.decorator.js';
import { CurrentPrincipal } from '@shared/presentation/auth/current-principal.decorators.js';
import type { AuthenticatedPrincipal } from '@shared/presentation/auth/principal.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { GetCurrentUser } from '../../application/use-cases/auth/get-current-user.js';
import { LoginWithPassword } from '../../application/use-cases/auth/login-with-password.js';
import { Logout } from '../../application/use-cases/auth/logout.js';
import { AuthQuotaGuard } from '../guards/auth-quota.guard.js';
import { presentAuthResult, presentCurrentUser } from './presenters/user.presenter.js';
import { loginBodySchema, type LoginBody } from './schemas/identity.schemas.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LoginWithPassword) private readonly loginWithPassword: LoginWithPassword,
    @Inject(Logout) private readonly logoutUseCase: Logout,
    @Inject(GetCurrentUser) private readonly getCurrentUser: GetCurrentUser,
  ) {}

  @Public()
  @UseGuards(AuthQuotaGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody, @ClientIp() clientIp: string) {
    return presentAuthResult(await this.loginWithPassword.execute({ ...body, clientIp }));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.logoutUseCase.execute({ token: extractBearerToken(request) });
  }

  @AllowDuringPasswordChange()
  @Get('me')
  async me(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return presentCurrentUser(await this.getCurrentUser.execute({ userId: principal.userId }));
  }
}
