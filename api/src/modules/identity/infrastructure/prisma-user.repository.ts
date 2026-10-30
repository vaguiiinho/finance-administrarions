import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { PrismaExecutor } from '@shared/infrastructure/prisma/prisma-executor.js';
import { EmailTakenError } from '../domain/user/errors/user-errors.js';
import type { User } from '../domain/user/user.js';
import type { UserRepository } from '../domain/user/user.repository.js';
import type { EmailAddress } from '../domain/user/value-objects/email-address.js';
import type { UserId } from '../domain/user/value-objects/user-id.js';
import { UserMapper } from './mappers/user.mapper.js';

const COLLATOR = new Intl.Collator('pt-BR');

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async insert(user: User): Promise<void> {
    try {
      await this.prisma.user.create({ data: UserMapper.toPersistence(user) });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async update(user: User): Promise<void> {
    const { id: _id, createdAt: _createdAt, ...data } = UserMapper.toPersistence(user);
    try {
      await this.prisma.user.update({ where: { id: user.id.value }, data });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id: id.value } });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: EmailAddress): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row ? UserMapper.toDomain(row) : null;
  }

  /** Ordenação no código com Intl (pt-BR): independe de a imagem do Postgres ter a collation ICU (ADR 8). */
  async listManageable(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ where: { kind: 'REGULAR' } });
    return rows
      .map((row) => UserMapper.toDomain(row))
      .sort(
        (a, b) =>
          Number(a.status === 'INACTIVE') - Number(b.status === 'INACTIVE') ||
          COLLATOR.compare(a.name.value, b.name.value) ||
          a.id.value.localeCompare(b.id.value),
      );
  }

  async countActiveAdminsExcept(except: UserId): Promise<number> {
    return this.prisma.user.count({
      where: { kind: 'REGULAR', role: 'ADMIN', status: 'ACTIVE', id: { not: except.value } },
    });
  }

  async countRegular(): Promise<number> {
    return this.prisma.user.count({ where: { kind: 'REGULAR' } });
  }
}

/** Único ponto que conhece o código P2002 do Prisma: unique de users.email -> EmailTakenError. */
function translateUniqueViolation(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && /email|users_email_uq/.test(JSON.stringify(error.meta ?? {}))) {
    return new EmailTakenError();
  }
  return error;
}
