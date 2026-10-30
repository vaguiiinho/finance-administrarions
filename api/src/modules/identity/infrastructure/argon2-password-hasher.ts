import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../application/ports/password-hasher.js';
import { PasswordHash } from '../domain/user/value-objects/password-hash.js';
import type { PlainPassword } from '../domain/user/value-objects/plain-password.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';

/** argon2id (m = 19456 KiB, t = 2, p = 1), o padrão do argon2 do `@node-rs/argon2`. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export class Argon2PasswordHasher implements PasswordHasher {
  /** Hash fictício gerado uma vez: confere usuários inexistentes no mesmo tempo de um real (RNF05). */
  private dummyHash: Promise<string> | null = null;

  async hash(password: PlainPassword): Promise<PasswordHash> {
    return unwrapPersisted(PasswordHash.create(await argon2Hash(password.reveal(), OPTIONS)), 'argon2 hash');
  }

  async verify(password: PlainPassword, hash: PasswordHash | null): Promise<boolean> {
    if (hash === null) {
      this.dummyHash ??= argon2Hash('dummy-password-for-timing-equalization', OPTIONS);
      await argon2Verify(await this.dummyHash, password.reveal()).catch(() => false);
      return false;
    }
    try {
      return await argon2Verify(hash.value, password.reveal());
    } catch {
      // Hash malformado: nunca autentica.
      return false;
    }
  }
}
