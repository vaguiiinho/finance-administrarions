import { Module, type Provider } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { CLOCK, type Clock } from '@shared/application/ports/clock.js';
import { DOMAIN_EVENT_PUBLISHER, type DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { ID_GENERATOR, type IdGenerator } from '@shared/application/ports/id-generator.js';
import { ATTEMPT_LIMITER, type AttemptLimiter } from './application/ports/attempt-limiter.js';
import { IDENTITY_AUDIT_LOG, type IdentityAuditLog } from './application/ports/identity-audit-log.js';
import { IDENTITY_UNIT_OF_WORK, type IdentityUnitOfWork } from './application/ports/identity-unit-of-work.js';
import { PASSWORD_HASHER, type PasswordHasher } from './application/ports/password-hasher.js';
import { SESSION_PRINCIPAL_LOOKUP, type SessionPrincipalLookup } from './application/ports/session-principal-lookup.js';
import { SESSION_TOKEN_ISSUER, type SessionTokenIssuer } from './application/ports/session-token-issuer.js';
import { ChangeOwnPassword } from './application/use-cases/account/change-own-password.js';
import { UpdateOwnProfile } from './application/use-cases/account/update-own-profile.js';
import { AuthenticateSession } from './application/use-cases/auth/authenticate-session.js';
import { CheckAuthRequestQuota } from './application/use-cases/auth/check-auth-request-quota.js';
import { GetCurrentUser } from './application/use-cases/auth/get-current-user.js';
import { LoginWithPassword } from './application/use-cases/auth/login-with-password.js';
import { Logout } from './application/use-cases/auth/logout.js';
import { PurgeExpiredSessions } from './application/use-cases/auth/purge-expired-sessions.js';
import { BootstrapFirstAdmin } from './application/use-cases/bootstrap/bootstrap-first-admin.js';
import { EnsureDemoUser } from './application/use-cases/bootstrap/ensure-demo-user.js';
import { RecoverAdminAccess } from './application/use-cases/bootstrap/recover-admin-access.js';
import { CreateUser } from './application/use-cases/user-admin/create-user.js';
import { DeactivateUser } from './application/use-cases/user-admin/deactivate-user.js';
import { GetUser } from './application/use-cases/user-admin/get-user.js';
import { ListUsers } from './application/use-cases/user-admin/list-users.js';
import { ReactivateUser } from './application/use-cases/user-admin/reactivate-user.js';
import { ResetUserPassword } from './application/use-cases/user-admin/reset-user-password.js';
import { UpdateUser } from './application/use-cases/user-admin/update-user.js';
import { SESSION_REPOSITORY, type SessionRepository } from './domain/session/session.repository.js';
import { USER_REPOSITORY, type UserRepository } from './domain/user/user.repository.js';
import { IDENTITY_INFRASTRUCTURE_PROVIDERS } from './infrastructure/identity-infrastructure.providers.js';
import { AccessControlGuard } from './presentation/guards/access-control.guard.js';
import { ACCESS_POLICIES, type AccessPolicy } from './presentation/guards/access-policy.js';
import { AuthQuotaGuard } from './presentation/guards/auth-quota.guard.js';
import { AuthenticationPolicy } from './presentation/guards/authentication.policy.js';
import { PasswordChangePolicy } from './presentation/guards/password-change.policy.js';
import { RolePolicy } from './presentation/guards/role.policy.js';
import { AccountController } from './presentation/http/account.controller.js';
import { AdminUsersController } from './presentation/http/admin-users.controller.js';
import { AuthController } from './presentation/http/auth.controller.js';

/** Use cases são classes simples: instanciadas por factory com as dependências injetadas por token. */
const USE_CASE_PROVIDERS: Provider[] = [
  {
    provide: LoginWithPassword,
    useFactory: (
      users: UserRepository,
      sessions: SessionRepository,
      hasher: PasswordHasher,
      tokens: SessionTokenIssuer,
      limiter: AttemptLimiter,
      audit: IdentityAuditLog,
      ids: IdGenerator,
      clock: Clock,
      publisher: DomainEventPublisher,
    ) => new LoginWithPassword(users, sessions, hasher, tokens, limiter, audit, ids, clock, publisher),
    inject: [
      USER_REPOSITORY,
      SESSION_REPOSITORY,
      PASSWORD_HASHER,
      SESSION_TOKEN_ISSUER,
      ATTEMPT_LIMITER,
      IDENTITY_AUDIT_LOG,
      ID_GENERATOR,
      CLOCK,
      DOMAIN_EVENT_PUBLISHER,
    ],
  },
  {
    provide: AuthenticateSession,
    useFactory: (tokens: SessionTokenIssuer, lookup: SessionPrincipalLookup, clock: Clock) =>
      new AuthenticateSession(tokens, lookup, clock),
    inject: [SESSION_TOKEN_ISSUER, SESSION_PRINCIPAL_LOOKUP, CLOCK],
  },
  { provide: GetCurrentUser, useFactory: (users: UserRepository) => new GetCurrentUser(users), inject: [USER_REPOSITORY] },
  {
    provide: Logout,
    useFactory: (tokens: SessionTokenIssuer, sessions: SessionRepository, clock: Clock, publisher: DomainEventPublisher) =>
      new Logout(tokens, sessions, clock, publisher),
    inject: [SESSION_TOKEN_ISSUER, SESSION_REPOSITORY, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: CheckAuthRequestQuota,
    useFactory: (limiter: AttemptLimiter, audit: IdentityAuditLog, clock: Clock) =>
      new CheckAuthRequestQuota(limiter, audit, clock),
    inject: [ATTEMPT_LIMITER, IDENTITY_AUDIT_LOG, CLOCK],
  },
  {
    provide: PurgeExpiredSessions,
    useFactory: (sessions: SessionRepository, clock: Clock) => new PurgeExpiredSessions(sessions, clock),
    inject: [SESSION_REPOSITORY, CLOCK],
  },
  {
    provide: ChangeOwnPassword,
    useFactory: (
      uow: IdentityUnitOfWork,
      hasher: PasswordHasher,
      limiter: AttemptLimiter,
      audit: IdentityAuditLog,
      clock: Clock,
      publisher: DomainEventPublisher,
    ) => new ChangeOwnPassword(uow, hasher, limiter, audit, clock, publisher),
    inject: [IDENTITY_UNIT_OF_WORK, PASSWORD_HASHER, ATTEMPT_LIMITER, IDENTITY_AUDIT_LOG, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  {
    provide: UpdateOwnProfile,
    useFactory: (users: UserRepository, clock: Clock, publisher: DomainEventPublisher) =>
      new UpdateOwnProfile(users, clock, publisher),
    inject: [USER_REPOSITORY, CLOCK, DOMAIN_EVENT_PUBLISHER],
  },
  { provide: ListUsers, useFactory: (users: UserRepository) => new ListUsers(users), inject: [USER_REPOSITORY] },
  { provide: GetUser, useFactory: (users: UserRepository) => new GetUser(users), inject: [USER_REPOSITORY] },
  {
    provide: CreateUser,
    useFactory: (
      uow: IdentityUnitOfWork,
      hasher: PasswordHasher,
      ids: IdGenerator,
      clock: Clock,
      publisher: DomainEventPublisher,
      audit: IdentityAuditLog,
    ) => new CreateUser(uow, hasher, ids, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, PASSWORD_HASHER, ID_GENERATOR, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: UpdateUser,
    useFactory: (uow: IdentityUnitOfWork, clock: Clock, publisher: DomainEventPublisher, audit: IdentityAuditLog) =>
      new UpdateUser(uow, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: DeactivateUser,
    useFactory: (uow: IdentityUnitOfWork, clock: Clock, publisher: DomainEventPublisher, audit: IdentityAuditLog) =>
      new DeactivateUser(uow, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: ReactivateUser,
    useFactory: (uow: IdentityUnitOfWork, clock: Clock, publisher: DomainEventPublisher, audit: IdentityAuditLog) =>
      new ReactivateUser(uow, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: ResetUserPassword,
    useFactory: (
      uow: IdentityUnitOfWork,
      hasher: PasswordHasher,
      clock: Clock,
      publisher: DomainEventPublisher,
      audit: IdentityAuditLog,
    ) => new ResetUserPassword(uow, hasher, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, PASSWORD_HASHER, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: BootstrapFirstAdmin,
    useFactory: (
      uow: IdentityUnitOfWork,
      hasher: PasswordHasher,
      clock: Clock,
      publisher: DomainEventPublisher,
      audit: IdentityAuditLog,
    ) => new BootstrapFirstAdmin(uow, hasher, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, PASSWORD_HASHER, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: RecoverAdminAccess,
    useFactory: (
      uow: IdentityUnitOfWork,
      hasher: PasswordHasher,
      clock: Clock,
      publisher: DomainEventPublisher,
      audit: IdentityAuditLog,
    ) => new RecoverAdminAccess(uow, hasher, clock, publisher, audit),
    inject: [IDENTITY_UNIT_OF_WORK, PASSWORD_HASHER, CLOCK, DOMAIN_EVENT_PUBLISHER, IDENTITY_AUDIT_LOG],
  },
  {
    provide: EnsureDemoUser,
    useFactory: (users: UserRepository, clock: Clock) => new EnsureDemoUser(users, clock),
    inject: [USER_REPOSITORY, CLOCK],
  },
];

const GUARD_PROVIDERS: Provider[] = [
  {
    provide: ACCESS_POLICIES,
    useFactory: (authenticate: AuthenticateSession): AccessPolicy[] => [
      new AuthenticationPolicy(authenticate),
      new PasswordChangePolicy(),
      new RolePolicy(),
    ],
    inject: [AuthenticateSession],
  },
  {
    provide: APP_GUARD,
    useFactory: (reflector: Reflector, policies: AccessPolicy[]) => new AccessControlGuard(reflector, policies),
    inject: [Reflector, ACCESS_POLICIES],
  },
  AuthQuotaGuard,
];

@Module({
  controllers: [AuthController, AccountController, AdminUsersController],
  providers: [...IDENTITY_INFRASTRUCTURE_PROVIDERS, ...USE_CASE_PROVIDERS, ...GUARD_PROVIDERS],
  exports: [
    PASSWORD_HASHER,
    SESSION_TOKEN_ISSUER,
    IDENTITY_AUDIT_LOG,
    EnsureDemoUser,
    BootstrapFirstAdmin,
    RecoverAdminAccess,
    PurgeExpiredSessions,
  ],
})
export class IdentityModule {}
