import { ForbiddenError, UnauthenticatedError, UserNotFoundError, UserValidationError } from '../../../domain/user/errors/user-errors.js';
import type { User } from '../../../domain/user/user.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';
import type { IdentityTransactionScope } from '../../ports/identity-unit-of-work.js';
import type { Actor } from '../../views.js';

/** Ids de path mal formados -> 400 VALIDATION_ERROR (convenção de docs/api/finance.md). */
export function parseTargetId(raw: string): UserId {
  const parsed = UserId.create(raw);
  if (!parsed.ok) {
    throw new UserValidationError([{ field: 'id', code: 'INVALID_FORMAT', message: 'Identificador inválido.' }]);
  }
  return parsed.value;
}

/**
 * ADR 5.4 passo 2, DENTRO da transação: ator inexistente, não REGULAR ou INACTIVE -> 401; não ADMIN -> 403.
 * Fecha a janela entre a autenticação e a escrita (CA24).
 */
export async function requireActiveAdmin(tx: IdentityTransactionScope, actor: Actor): Promise<User> {
  const id = UserId.create(actor.userId);
  const user = id.ok ? await tx.users.findById(id.value) : null;
  if (!user || !user.canAuthenticate()) throw new UnauthenticatedError();
  if (user.role !== 'ADMIN') throw new ForbiddenError();
  return user;
}

/** Inexistente ou não gerenciável (marcador do primeiro administrador, conta demo) -> 404 USER_NOT_FOUND (RF18). */
export async function loadManageable(users: { findById(id: UserId): Promise<User | null> }, id: UserId): Promise<User> {
  const user = await users.findById(id);
  if (!user || !user.isManageable()) throw new UserNotFoundError(id.value);
  return user;
}
