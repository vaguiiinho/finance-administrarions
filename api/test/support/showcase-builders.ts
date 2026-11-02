import { aUser, type UserOverrides } from './identity-builders.js';
import type { User } from '@identity/domain/user/user.js';

/** Constantes do ADR 0011 3.3 (copiadas como literais de proposito: o teste nao pode depender do codigo que valida). */
export const SHOWCASE_ID = '01900000-0000-7000-8000-0000000000d2';
export const SHOWCASE_EMAIL = 'demo@showcase.invalid';
export const SHOWCASE_NAME = 'Conta de demonstração';
export const SHOWCASE_PASSWORD = 'demo';

/** Conta de demonstracao valida (kind SHOWCASE) reidratada via `User.restore`, com hash fake de "demo". */
export const showcaseUser = (o: UserOverrides = {}): User =>
  aUser({
    id: SHOWCASE_ID,
    name: SHOWCASE_NAME,
    email: SHOWCASE_EMAIL,
    kind: 'SHOWCASE' as never,
    role: 'USER',
    mustChangePassword: false,
    password: SHOWCASE_PASSWORD,
    ...o,
  });
