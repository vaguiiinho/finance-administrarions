import { InvariantViolationError } from '@shared/domain/app-error.js';
import { OwnerId } from '../../domain/owner/owner-id.js';

/**
 * O dono vem do principal autenticado, nunca do corpo (RF23): valor malformado é erro de programação (500), não 400.
 */
export function requireOwnerId(raw: string): OwnerId {
  const parsed = OwnerId.create(raw);
  if (!parsed.ok) throw new InvariantViolationError('ownerId inválido: o dono deve vir do principal autenticado.');
  return parsed.value;
}
