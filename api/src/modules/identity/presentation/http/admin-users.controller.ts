import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { RequireRole } from '@shared/presentation/auth/access-metadata.js';
import { ClientIp } from '@shared/presentation/auth/client-ip.decorator.js';
import { CurrentPrincipal } from '@shared/presentation/auth/current-principal.decorators.js';
import type { AuthenticatedPrincipal } from '@shared/presentation/auth/principal.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { CreateUser } from '../../application/use-cases/user-admin/create-user.js';
import { DeactivateUser } from '../../application/use-cases/user-admin/deactivate-user.js';
import { GetUser } from '../../application/use-cases/user-admin/get-user.js';
import { ListUsers } from '../../application/use-cases/user-admin/list-users.js';
import { ReactivateUser } from '../../application/use-cases/user-admin/reactivate-user.js';
import { ResetUserPassword } from '../../application/use-cases/user-admin/reset-user-password.js';
import { UpdateUser } from '../../application/use-cases/user-admin/update-user.js';
import type { Actor } from '../../application/views.js';
import { presentAdminUser } from './presenters/user.presenter.js';
import {
  createUserBodySchema,
  resetPasswordBodySchema,
  updateUserBodySchema,
  type CreateUserBody,
  type ResetPasswordBody,
  type UpdateUserBody,
} from './schemas/identity.schemas.js';

const actorOf = (principal: AuthenticatedPrincipal, clientIp: string): Actor => ({ userId: principal.userId, clientIp });

@RequireRole('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @Inject(ListUsers) private readonly listUsers: ListUsers,
    @Inject(GetUser) private readonly getUser: GetUser,
    @Inject(CreateUser) private readonly createUser: CreateUser,
    @Inject(UpdateUser) private readonly updateUser: UpdateUser,
    @Inject(DeactivateUser) private readonly deactivateUser: DeactivateUser,
    @Inject(ReactivateUser) private readonly reactivateUser: ReactivateUser,
    @Inject(ResetUserPassword) private readonly resetUserPassword: ResetUserPassword,
  ) {}

  @Get()
  async list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @ClientIp() clientIp: string) {
    const items = await this.listUsers.execute({ actor: actorOf(principal, clientIp) });
    return { items: items.map(presentAdminUser) };
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentPrincipal() principal: AuthenticatedPrincipal, @ClientIp() clientIp: string) {
    return presentAdminUser(await this.getUser.execute({ actor: actorOf(principal, clientIp), id }));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createUserBodySchema)) body: CreateUserBody,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @ClientIp() clientIp: string,
  ) {
    return presentAdminUser(await this.createUser.execute({ actor: actorOf(principal, clientIp), ...body }));
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserBodySchema)) body: UpdateUserBody,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @ClientIp() clientIp: string,
  ) {
    return presentAdminUser(await this.updateUser.execute({ actor: actorOf(principal, clientIp), id, ...body }));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  async deactivate(@Param('id') id: string, @CurrentPrincipal() principal: AuthenticatedPrincipal, @ClientIp() clientIp: string) {
    return presentAdminUser(await this.deactivateUser.execute({ actor: actorOf(principal, clientIp), id }));
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  async reactivate(@Param('id') id: string, @CurrentPrincipal() principal: AuthenticatedPrincipal, @ClientIp() clientIp: string) {
    return presentAdminUser(await this.reactivateUser.execute({ actor: actorOf(principal, clientIp), id }));
  }

  @Post(':id/password-reset')
  @HttpCode(200)
  async resetPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resetPasswordBodySchema)) body: ResetPasswordBody,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @ClientIp() clientIp: string,
  ) {
    return presentAdminUser(await this.resetUserPassword.execute({ actor: actorOf(principal, clientIp), id, ...body }));
  }
}
