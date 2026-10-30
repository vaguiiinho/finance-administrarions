import type { PasswordHash } from '../../domain/user/value-objects/password-hash.js';
import type { PlainPassword } from '../../domain/user/value-objects/plain-password.js';

export interface PasswordHasher {
  hash(password: PlainPassword): Promise<PasswordHash>;
  /** Com hash null verifica contra um hash fictício e devolve false no mesmo tempo (RNF05). */
  verify(password: PlainPassword, hash: PasswordHash | null): Promise<boolean>;
}
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
