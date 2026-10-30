import { FirstAdminConfigError } from './errors/user-errors.js';
import { EmailAddress } from './value-objects/email-address.js';
import { PlainPassword } from './value-objects/plain-password.js';
import { UserName } from './value-objects/user-name.js';

export interface FirstAdminEnv {
  ADMIN_NAME?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

/** Campos = nomes das variáveis. Lança FirstAdminConfigError (nunca com valores). `.invalid` -> ADMIN_EMAIL INVALID_FORMAT. */
export function parseFirstAdminConfig(env: FirstAdminEnv): { name: UserName; email: EmailAddress; password: PlainPassword } {
  const problems: { name: string; code: string }[] = [];
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  const name = UserName.create(str(env.ADMIN_NAME));
  if (!name.ok) problems.push({ name: 'ADMIN_NAME', code: name.error });

  const email = EmailAddress.create(str(env.ADMIN_EMAIL));
  if (!email.ok) problems.push({ name: 'ADMIN_EMAIL', code: email.error });
  else if (email.value.isReserved()) problems.push({ name: 'ADMIN_EMAIL', code: 'INVALID_FORMAT' });

  const password = PlainPassword.create(str(env.ADMIN_PASSWORD));
  if (!password.ok) problems.push({ name: 'ADMIN_PASSWORD', code: password.error });

  if (problems.length > 0 || !name.ok || !email.ok || !password.ok) throw new FirstAdminConfigError(problems);
  return { name: name.value, email: email.value, password: password.value };
}
