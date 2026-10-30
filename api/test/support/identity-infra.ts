import { inject } from 'vitest';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { PrismaUserRepository } from '@identity/infrastructure/prisma-user.repository.js';
import { PrismaSessionRepository } from '@identity/infrastructure/prisma-session.repository.js';
import { PrismaSessionPrincipalLookup } from '@identity/infrastructure/prisma-session-principal-lookup.js';
import { PrismaIdentityUnitOfWork } from '@identity/infrastructure/prisma-identity-unit-of-work.js';
import { DeactivateUser } from '@identity/application/use-cases/user-admin/deactivate-user.js';
import { UpdateUser } from '@identity/application/use-cases/user-admin/update-user.js';
import { BootstrapFirstAdmin } from '@identity/application/use-cases/bootstrap/bootstrap-first-admin.js';
import { FakePasswordHasher, SpyIdentityAuditLog } from '../fakes/identity-fakes.js';
import { FixedClock, SpyEventPublisher } from '../fakes/simple-fakes.js';
import { NOW } from './builders.js';

/** Infra REAL do identity sobre o Postgres do container. `databaseUrl` opcional (banco de migracao). Ajuste so aqui se os construtores diferirem. */
export async function buildIdentityInfra(databaseUrl: string = inject('databaseUrl')) {
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaService();
  await prisma.$connect();
  const clock = new FixedClock(NOW);
  const hasher = new FakePasswordHasher();
  const audit = new SpyIdentityAuditLog();
  const publisher = new SpyEventPublisher();
  const uow = new PrismaIdentityUnitOfWork(prisma);
  return {
    prisma,
    clock,
    hasher,
    audit,
    publisher,
    uow,
    users: new PrismaUserRepository(prisma),
    sessions: new PrismaSessionRepository(prisma),
    lookup: new PrismaSessionPrincipalLookup(prisma),
    deactivateUser: new DeactivateUser(uow, clock, publisher, audit),
    updateUser: new UpdateUser(uow, clock, publisher, audit),
    bootstrap: () => new BootstrapFirstAdmin(uow, hasher, clock, publisher, audit),
    close: () => prisma.$disconnect(),
  };
}

export type IdentityInfra = Awaited<ReturnType<typeof buildIdentityInfra>>;
