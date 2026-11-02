import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import { startE2eApp, type E2eApp } from './e2e-app.js';
import { insertUser, resetAll, type UserRow } from './owned-db.js';
import { userUuid } from './identity-builders.js';
import { PASSWORD_HASHER, type PasswordHasher } from '@identity/application/ports/password-hasher.js';
import { SESSION_TOKEN_ISSUER, type SessionTokenIssuer } from '@identity/application/ports/session-token-issuer.js';
import { PlainPassword } from '@identity/domain/user/value-objects/plain-password.js';
import { unwrap } from './result.js';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';

export interface IdentityE2e extends E2eApp {
  resetAll: () => Promise<void>;
  /** Cria o usuario por SQL (hash real do PasswordHasher da aplicacao). */
  seedUser: (row: UserRow & { password?: string }) => Promise<{ id: string; email: string; password: string }>;
  /** Abre uma sessao valida por SQL (sem passar pelo login, para nao consumir o limite por IP). */
  sessionFor: (userId: string, opts?: { createdAtOffsetMs?: number; expiresAtOffsetMs?: number }) => Promise<string>;
  /** IP unico por chamada (X-Forwarded-For respeitado pelo trust proxy): isola os limites de tentativas. */
  freshIp: () => string;
}

let ipCounter = 0;
let sessionCounter = 1000;
const hashCache = new Map<string, string>();

/** Sobe a app real e devolve fixtures de usuarios/sessoes. CONTRATO: tokens PASSWORD_HASHER e SESSION_TOKEN_ISSUER no container Nest. */
export async function startIdentityE2e(): Promise<IdentityE2e> {
  const e = await startE2eApp();
  const hasher = e.app.get<PasswordHasher>(PASSWORD_HASHER);
  const issuer = e.app.get<SessionTokenIssuer>(SESSION_TOKEN_ISSUER);

  const hashFor = async (password: string): Promise<string> => {
    const cached = hashCache.get(password);
    if (cached) return cached;
    const hash = (await hasher.hash(unwrap<PlainPassword>(PlainPassword.create(password)))).value;
    hashCache.set(password, hash);
    return hash;
  };

  return {
    ...e,
    resetAll: () => resetAll(e.pool),
    seedUser: async ({ password = 'segredo123', ...row }) => {
      const kind = row.kind ?? 'REGULAR';
      const id = await insertUser(e.pool, {
        ...row,
        // O usuario DEMO tem id fixo (ADR 0005 2.3); sem isto os testes que inserem dados do dataset publico violam a FK.
        id: row.id ?? (kind === 'DEMO' ? DEMO_USER_ID : undefined),
        passwordHash: row.passwordHash !== undefined ? row.passwordHash : kind === 'REGULAR' ? await hashFor(password) : null,
      });
      return { id, email: row.email ?? `user${row.n}@exemplo.com`, password };
    },
    sessionFor: async (userId, opts = {}) => {
      const { token, digest } = issuer.issue();
      const now = e.clock.now().getTime();
      await e.pool.query(
        `INSERT INTO sessions (id, user_id, token_digest, created_at, expires_at) VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz, $5::timestamptz)`,
        [
          `0b000000-0000-7000-8000-${String(++sessionCounter).padStart(12, '0')}`,
          userId,
          digest.value,
          new Date(now + (opts.createdAtOffsetMs ?? 0)).toISOString(),
          new Date(now + (opts.expiresAtOffsetMs ?? 24 * 3_600_000)).toISOString(),
        ],
      );
      return token;
    },
    freshIp: () => `198.51.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`,
  };
}

/** Personagens padrao: Ana (n=1) e Bruno (n=2) comuns, Carla (n=3) com troca obrigatoria, Vagner (n=4) admin. */
export const CAST = {
  ana: { n: 1, name: 'Ana Souza', email: 'ana@exemplo.com' },
  bruno: { n: 2, name: 'Bruno Lima', email: 'bruno@exemplo.com' },
  carla: { n: 3, name: 'Carla Dias', email: 'carla@exemplo.com', mustChangePassword: true, password: 'Temp1234' },
  vagner: { n: 4, name: 'Vagner', email: 'vagner@exemplo.com', role: 'ADMIN' as const },
  outroAdmin: { n: 5, name: 'Outro Admin', email: 'admin2@exemplo.com', role: 'ADMIN' as const },
};
export const idOf = (n: number) => userUuid(n);
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export type Http = ReturnType<typeof request>;

/** Rotas registradas no Express (metodo + caminho com `:param`), para os testes "seguro por padrao". */
export function listRoutes(app: INestApplication): { method: string; path: string }[] {
  const instance = app.getHttpAdapter().getInstance() as { router?: { stack: any[] }; _router?: { stack: any[] } };
  const stack = (instance.router ?? instance._router)?.stack ?? [];
  const routes: { method: string; path: string }[] = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      if (layer.route.methods[method]) routes.push({ method: method.toUpperCase(), path: layer.route.path as string });
    }
  }
  return routes;
}

export const concretePath = (path: string): string =>
  path
    .replace(/:referenceMonth/g, '2026-11')
    .replace(/:(cardId|id)/g, '0c000000-0000-7000-8000-0000000000aa');
