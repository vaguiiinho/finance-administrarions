import type { FieldViolation } from '@shared/domain/app-error.js';
import { UserValidationError } from './errors/user-errors.js';
import { collect, collectEmail } from './parse-support.js';
import type { EmailAddress } from './value-objects/email-address.js';
import { PlainPassword } from './value-objects/plain-password.js';
import { UserName } from './value-objects/user-name.js';
import { parseRole, type UserRole } from './value-objects/user-role.js';

/** Acumula as violações dos quatro campos e lança UserValidationError (CA18). E-mail reservado (`.invalid`) é rejeitado (INVALID_FORMAT). */
export function parseNewUser(raw: {
  name: unknown;
  email: unknown;
  role: unknown;
  password: unknown;
}): { name: UserName; email: EmailAddress; role: UserRole; password: PlainPassword } {
  const violations: FieldViolation[] = [];
  const name = collect(violations, 'name', UserName.create(asString(raw.name)));
  const email = collectEmail(violations, 'email', asString(raw.email));
  const role = collect(violations, 'role', parseRole(raw.role));
  const password = collect(violations, 'password', PlainPassword.create(asString(raw.password)));
  if (violations.length > 0 || !name || !email || !role || !password) throw new UserValidationError(violations);
  return { name, email, role, password };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

