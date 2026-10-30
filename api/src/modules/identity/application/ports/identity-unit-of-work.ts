import type { SessionRepository } from '../../domain/session/session.repository.js';
import type { UserRepository } from '../../domain/user/user.repository.js';

export interface IdentityTransactionScope {
  users: UserRepository;
  sessions: SessionRepository;
  /** Serializa toda mudança no conjunto de administradores ativos até o fim da transação (T14). */
  lockAdminSet(): Promise<void>;
  /** Serializa a inicialização do primeiro administrador entre instâncias (T12). */
  lockFirstAdminBootstrap(): Promise<void>;
}
export interface IdentityUnitOfWork {
  run<T>(work: (scope: IdentityTransactionScope) => Promise<T>): Promise<T>;
}
export const IDENTITY_UNIT_OF_WORK = Symbol('IDENTITY_UNIT_OF_WORK');
