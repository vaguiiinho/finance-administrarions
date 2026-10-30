import type { Provider } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/application/ports/clock.js';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { ATTEMPT_LIMITER } from '../application/ports/attempt-limiter.js';
import { IDENTITY_AUDIT_LOG } from '../application/ports/identity-audit-log.js';
import { IDENTITY_UNIT_OF_WORK } from '../application/ports/identity-unit-of-work.js';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.js';
import { SESSION_PRINCIPAL_LOOKUP } from '../application/ports/session-principal-lookup.js';
import { SESSION_TOKEN_ISSUER } from '../application/ports/session-token-issuer.js';
import { SESSION_REPOSITORY } from '../domain/session/session.repository.js';
import { USER_REPOSITORY } from '../domain/user/user.repository.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { HmacSessionTokenIssuer } from './hmac-session-token-issuer.js';
import { InMemoryAttemptLimiter } from './in-memory-attempt-limiter.js';
import { LoggerIdentityAuditLog } from './logger-identity-audit-log.js';
import { PrismaIdentityUnitOfWork } from './prisma-identity-unit-of-work.js';
import { PrismaSessionPrincipalLookup } from './prisma-session-principal-lookup.js';
import { PrismaSessionRepository } from './prisma-session.repository.js';
import { PrismaUserRepository } from './prisma-user.repository.js';
import { requireSessionSecret } from './session-secret.js';

/** Token -> implementação (único lugar que liga os ports do identity às implementações). */
export const IDENTITY_INFRASTRUCTURE_PROVIDERS: Provider[] = [
  { provide: PASSWORD_HASHER, useFactory: () => new Argon2PasswordHasher() },
  { provide: SESSION_TOKEN_ISSUER, useFactory: () => new HmacSessionTokenIssuer(requireSessionSecret()) },
  { provide: ATTEMPT_LIMITER, useFactory: (clock: Clock) => new InMemoryAttemptLimiter(clock), inject: [CLOCK] },
  { provide: IDENTITY_AUDIT_LOG, useFactory: () => new LoggerIdentityAuditLog() },
  { provide: USER_REPOSITORY, useFactory: (prisma: PrismaService) => new PrismaUserRepository(prisma), inject: [PrismaService] },
  {
    provide: SESSION_REPOSITORY,
    useFactory: (prisma: PrismaService) => new PrismaSessionRepository(prisma),
    inject: [PrismaService],
  },
  {
    provide: SESSION_PRINCIPAL_LOOKUP,
    useFactory: (prisma: PrismaService) => new PrismaSessionPrincipalLookup(prisma),
    inject: [PrismaService],
  },
  {
    provide: IDENTITY_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService) => new PrismaIdentityUnitOfWork(prisma),
    inject: [PrismaService],
  },
];
