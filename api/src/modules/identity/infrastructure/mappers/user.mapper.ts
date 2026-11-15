import { unwrapPersisted } from '@shared/domain/unwrap.js';
import type { Prisma, User as UserRow } from '@shared/infrastructure/prisma/generated/client.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import { User } from '../../domain/user/user.js';
import type { UserKind } from '../../domain/user/value-objects/user-status.js';
import { EmailAddress } from '../../domain/user/value-objects/email-address.js';
import { PasswordHash } from '../../domain/user/value-objects/password-hash.js';
import { UserId } from '../../domain/user/value-objects/user-id.js';
import { UserName } from '../../domain/user/value-objects/user-name.js';

/** O valor legado do enum do banco não é mais suportado (barrado por users_kind_not_demo_chk). */
function toUserKind(kind: UserRow['kind']): UserKind {
  switch (kind) {
    case 'REGULAR':
    case 'PENDING_FIRST_ADMIN':
    case 'SHOWCASE':
      return kind;
    default:
      throw new InvariantViolationError(`users.kind ${String(kind)} não é mais suportado.`);
  }
}

export const UserMapper = {
  toDomain(row: UserRow): User {
    return User.restore({
      id: unwrapPersisted(UserId.create(row.id), 'users.id'),
      name: unwrapPersisted(UserName.create(row.name), 'users.name'),
      email: unwrapPersisted(EmailAddress.create(row.email), 'users.email'),
      passwordHash:
        row.passwordHash === null ? null : unwrapPersisted(PasswordHash.create(row.passwordHash), 'users.password_hash'),
      kind: toUserKind(row.kind),
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
