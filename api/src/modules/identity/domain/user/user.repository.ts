import type { EmailAddress } from './value-objects/email-address.js';
import type { UserId } from './value-objects/user-id.js';
import type { User } from './user.js';

export interface UserRepository {
  /** Lança EmailTakenError se users_email_uq for violado (inclusive em corrida). */
  insert(user: User): Promise<void>;
  /** Persiste todos os campos mutáveis. Idem EmailTakenError. */
  update(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  /** Só kind = REGULAR. Ordem: ACTIVE antes de INACTIVE, depois nome (pt-BR), depois id. */
  listManageable(): Promise<User[]>;
  /** kind = REGULAR, role = ADMIN, status = ACTIVE, id <> except. Chamar sob lockAdminSet. */
  countActiveAdminsExcept(except: UserId): Promise<number>;
  /** Quantos usuários kind = REGULAR existem. */
  countRegular(): Promise<number>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
