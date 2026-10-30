import { LastAdminError } from './errors/user-errors.js';
import type { User } from './user.js';

export const LastActiveAdminPolicy = {
  /**
   * `target`: estado ANTES da mudança; `after`: estado DEPOIS. `otherActiveAdmins`: administradores ativos além do alvo.
   * Lança LastAdminError se a mudança tira o último administrador ativo.
   */
  assertKeepsAnActiveAdmin(target: User, after: User, otherActiveAdmins: number): void {
    if (target.isActiveAdmin() && !after.isActiveAdmin() && otherActiveAdmins === 0) throw new LastAdminError();
  },
};
