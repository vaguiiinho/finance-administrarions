import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import type { IdentityTransactionScope, IdentityUnitOfWork } from '../application/ports/identity-unit-of-work.js';
import { PrismaSessionRepository } from './prisma-session.repository.js';
import { PrismaUserRepository } from './prisma-user.repository.js';

const TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 5_000 } as const;

/** Uma transação interativa; os locks consultivos duram até o fim dela (T12, T14). */
export class PrismaIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (scope: IdentityTransactionScope) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) =>
        work({
          users: new PrismaUserRepository(tx),
          sessions: new PrismaSessionRepository(tx),
          lockAdminSet: async () => {
            await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('identity:admin-set'))`);
          },
          lockFirstAdminBootstrap: async () => {
            await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('identity:first-admin'))`);
          },
        }),
      TRANSACTION_OPTIONS,
    );
  }
}
