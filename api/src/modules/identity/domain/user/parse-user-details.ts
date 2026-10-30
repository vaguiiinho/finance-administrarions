import type { FieldViolation } from '@shared/domain/app-error.js';
import { UserValidationError } from './errors/user-errors.js';
import { collect } from './parse-support.js';
import { EmailAddress } from './value-objects/email-address.js';
import { UserName } from './value-objects/user-name.js';
import { parseRole, type UserRole } from './value-objects/user-role.js';

export function parseUserDetails(raw: {
  name: unknown;
  email: unknown;
  role: unknown;
}): { name: UserName; email: EmailAddress; role: UserRole } {
  const violations: FieldViolation[] = [];
  const name = collect(violations, 'name', UserName.create(typeof raw.name === 'string' ? raw.name : ''));
  const email = collect(violations, 'email', EmailAddress.create(typeof raw.email === 'string' ? raw.email : ''));
  const role = collect(violations, 'role', parseRole(raw.role));
  if (violations.length > 0 || !name || !email || !role) throw new UserValidationError(violations);
  return { name, email, role };
}
