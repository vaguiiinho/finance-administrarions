import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { Prisma, User as UserRow } from '@shared/infrastructure/prisma/generated/client.js';
import { User } from '../../domain/user/user.js';
import { EmailAddress } from '../../domain/user/value-objects/email-address.js';
import { PasswordHash } from '../../domain/user/value-objects/password-hash.js';
import { UserId } from '../../domain/user/value-objects/user-id.js';
import { UserName } from '../../domain/user/value-objects/user-name.js';

export const UserMapper = {
  toDomain(row: UserRow): User {
    return User.restore({
      id: unwrapPersisted(UserId.create(row.id), 'users.id'),
      name: unwrapPersisted(UserName.create(row.name), 'users.name'),
      email: unwrapPersisted(EmailAddress.create(row.email), 'users.email'),
      passwordHash:
        row.passwordHash === null ? null : unwrapPersisted(PasswordHash.create(row.passwordHash), 'users.password_hash'),
      kind: row.kind,
      role: row.role,
      status: row.status,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(user: User): Prisma.UserUncheckedCreateInput {
    const s = user.toSnapshot();
    return {
      id: s.id.value,
      name: s.name.value,
      email: s.email.value,
      passwordHash: s.passwordHash?.value ?? null,
      kind: s.kind,
      role: s.role,
      status: s.status,
      mustChangePassword: s.mustChangePassword,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  },
};
