import { unwrap } from './result.js';
import { NOW } from './builders.js';
import { User } from '@identity/domain/user/user.js';
import { UserId } from '@identity/domain/user/value-objects/user-id.js';
import { UserName } from '@identity/domain/user/value-objects/user-name.js';
import { EmailAddress } from '@identity/domain/user/value-objects/email-address.js';
import { PasswordHash } from '@identity/domain/user/value-objects/password-hash.js';
import { PlainPassword } from '@identity/domain/user/value-objects/plain-password.js';
import type { UserRole } from '@identity/domain/user/value-objects/user-role.js';
import type { UserKind, UserStatus } from '@identity/domain/user/value-objects/user-status.js';
import type { Actor } from '@identity/application/views.js';
import { DEMO_USER_ID, FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';

const pad = (n: number) => String(n).padStart(12, '0');
export const userUuid = (n: number) => `0a000000-0000-7000-8000-${pad(n)}`;
export const sessionUuid = (n: number) => `0b000000-0000-7000-8000-${pad(n)}`;

export const userId = (raw: string): UserId => unwrap<UserId>(UserId.create(raw));
export const userName = (raw: string): UserName => unwrap<UserName>(UserName.create(raw));
export const emailOf = (raw: string): EmailAddress => unwrap<EmailAddress>(EmailAddress.create(raw));
export const plain = (raw: string): PlainPassword => unwrap<PlainPassword>(PlainPassword.create(raw));
/** Hash do FakePasswordHasher (nao e um hash de verdade; o dominio so ve uma string opaca). */
export const hashOf = (password: string): PasswordHash => unwrap<PasswordHash>(PasswordHash.create(`$fake$${password}`));

/** Ids dos personagens dos testes. */
export const N = { ana: 1, bruno: 2, carla: 3, vagner: 4, outroAdmin: 5, demo: 90, marker: 91 } as const;
export const DEFAULT_PASSWORD = 'segredo123';

export interface UserOverrides {
  n?: number;
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  kind?: UserKind;
  mustChangePassword?: boolean;
  password?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** CONTRATO ASSUMIDO: `User.restore(snapshot)` com VOs (UserSnapshot). Ajuste so aqui se diferir. */
export function aUser(o: UserOverrides = {}): User {
  const n = o.n ?? 1;
  const password = o.password === undefined ? DEFAULT_PASSWORD : o.password;
  return User.restore({
    id: userId(o.id ?? userUuid(n)),
    name: userName(o.name ?? `Usuario ${n}`),
    email: emailOf(o.email ?? `user${n}@exemplo.com`),
    passwordHash: password === null ? null : hashOf(password),
    kind: o.kind ?? 'REGULAR',
    role: o.role ?? 'USER',
    status: o.status ?? 'ACTIVE',
    mustChangePassword: o.mustChangePassword ?? false,
    createdAt: o.createdAt ?? NOW,
    updatedAt: o.updatedAt ?? NOW,
  });
}

export const ana = (o: UserOverrides = {}) => aUser({ n: N.ana, name: 'Ana Souza', email: 'ana@exemplo.com', ...o });
export const bruno = (o: UserOverrides = {}) => aUser({ n: N.bruno, name: 'Bruno Lima', email: 'bruno@exemplo.com', ...o });
export const carla = (o: UserOverrides = {}) =>
  aUser({ n: N.carla, name: 'Carla Dias', email: 'carla@exemplo.com', mustChangePassword: true, password: 'Temp1234', ...o });
export const vagner = (o: UserOverrides = {}) =>
  aUser({ n: N.vagner, name: 'Vagner', email: 'vagner@exemplo.com', role: 'ADMIN', ...o });
export const outroAdmin = (o: UserOverrides = {}) =>
  aUser({ n: N.outroAdmin, name: 'Outro Admin', email: 'admin2@exemplo.com', role: 'ADMIN', ...o });
export const demoUser = (o: UserOverrides = {}) =>
  aUser({ id: DEMO_USER_ID, name: 'Demonstração', email: 'demo@finance.invalid', kind: 'DEMO', password: null, ...o });
export const firstAdminMarker = (o: UserOverrides = {}) =>
  aUser({
    id: FIRST_ADMIN_ID,
    name: 'Administrador',
    email: 'first-admin@finance.invalid',
    kind: 'PENDING_FIRST_ADMIN',
    role: 'ADMIN',
    mustChangePassword: true,
    password: null,
    ...o,
  });

export const actorOf = (user: User, clientIp = '203.0.113.9'): Actor => ({ userId: user.id.value, clientIp });
