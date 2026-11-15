import { FixedClock, SequentialIdGenerator, SpyEventPublisher } from '../fakes/simple-fakes.js';
import {
  CountingAttemptLimiter,
  FakePasswordHasher,
  FixedTokenIssuer,
  InMemoryIdentityUnitOfWork,
  InMemorySessionPrincipalLookup,
  InMemorySessionRepository,
  InMemoryUserRepository,
  SpyIdentityAuditLog,
} from '../fakes/identity-fakes.js';
import { NOW } from './builders.js';
import { sessionUuid, userId } from './identity-builders.js';
import { Session } from '@identity/domain/session/session.js';
import { SessionId } from '@identity/domain/session/value-objects/session-id.js';
import type { User } from '@identity/domain/user/user.js';
import { unwrap } from './result.js';
import { LoginWithPassword } from '@identity/application/use-cases/auth/login-with-password.js';
import { AuthenticateSession } from '@identity/application/use-cases/auth/authenticate-session.js';
import { GetCurrentUser } from '@identity/application/use-cases/auth/get-current-user.js';
import { Logout } from '@identity/application/use-cases/auth/logout.js';
import { CheckAuthRequestQuota } from '@identity/application/use-cases/auth/check-auth-request-quota.js';
import { PurgeExpiredSessions } from '@identity/application/use-cases/auth/purge-expired-sessions.js';
import { ChangeOwnPassword } from '@identity/application/use-cases/account/change-own-password.js';
import { UpdateOwnProfile } from '@identity/application/use-cases/account/update-own-profile.js';
import { ListUsers } from '@identity/application/use-cases/user-admin/list-users.js';
import { GetUser } from '@identity/application/use-cases/user-admin/get-user.js';
import { CreateUser } from '@identity/application/use-cases/user-admin/create-user.js';
import { UpdateUser } from '@identity/application/use-cases/user-admin/update-user.js';
import { DeactivateUser } from '@identity/application/use-cases/user-admin/deactivate-user.js';
import { ReactivateUser } from '@identity/application/use-cases/user-admin/reactivate-user.js';
import { ResetUserPassword } from '@identity/application/use-cases/user-admin/reset-user-password.js';
import { BootstrapFirstAdmin } from '@identity/application/use-cases/bootstrap/bootstrap-first-admin.js';
import { RecoverAdminAccess } from '@identity/application/use-cases/bootstrap/recover-admin-access.js';

/**
 * Composicao dos use cases do identity sobre fakes em memoria.
 * CONTRATO ASSUMIDO: construtores posicionais na ordem dos esqueletos em
 * `src/modules/identity/application/use-cases/**` e `execute(input)`. Ajuste APENAS este arquivo se diferir.
 */
export function buildIdentityHarness(now: Date = NOW) {
  const log: string[] = [];
  const clock = new FixedClock(now);
  const ids = new SequentialIdGenerator();
  const publisher = new SpyEventPublisher();
  const users = new InMemoryUserRepository(log);
  const sessions = new InMemorySessionRepository();
  const uow = new InMemoryIdentityUnitOfWork(users, sessions, log);
  const hasher = new FakePasswordHasher(log);
  const tokens = new FixedTokenIssuer();
  const limiter = new CountingAttemptLimiter();
  const audit = new SpyIdentityAuditLog();
  const lookup = new InMemorySessionPrincipalLookup(users, sessions);

  let sessionCounter = 0;
  /** Abre uma sessao valida para o usuario (ja gravada); devolve o token em claro. */
  function openSession(user: User, at: Date = clock.now()): { token: string; sessionId: string } {
    const { token, digest } = tokens.issue();
    const sessionId = sessionUuid(++sessionCounter);
    sessions.seed(
      Session.open({ id: unwrap<SessionId>(SessionId.create(sessionId)), userId: userId(user.id.value), tokenDigest: digest, now: at }),
    );
    return { token, sessionId };
  }

  return {
    log,
    clock,
    ids,
    publisher,
    users,
    sessions,
    uow,
    hasher,
    tokens,
    limiter,
    audit,
    lookup,
    openSession,
    login: new LoginWithPassword(users, sessions, hasher, tokens, limiter, audit, ids, clock, publisher),
    authenticate: new AuthenticateSession(tokens, lookup, clock),
    currentUser: new GetCurrentUser(users),
    logout: new Logout(tokens, sessions, clock, publisher),
    quota: new CheckAuthRequestQuota(limiter, audit, clock),
    purge: new PurgeExpiredSessions(sessions, clock),
    changePassword: new ChangeOwnPassword(uow, hasher, limiter, audit, clock, publisher, users),
    updateProfile: new UpdateOwnProfile(users, clock, publisher),
    listUsers: new ListUsers(users),
    getUser: new GetUser(users),
    createUser: new CreateUser(uow, hasher, ids, clock, publisher, audit),
    updateUser: new UpdateUser(uow, clock, publisher, audit),
    deactivateUser: new DeactivateUser(uow, clock, publisher, audit),
    reactivateUser: new ReactivateUser(uow, clock, publisher, audit),
    resetPassword: new ResetUserPassword(uow, hasher, clock, publisher, audit),
    bootstrap: new BootstrapFirstAdmin(uow, hasher, clock, publisher, audit),
    recover: new RecoverAdminAccess(uow, hasher, clock, publisher, audit),
  };
}

export type IdentityHarness = ReturnType<typeof buildIdentityHarness>;
