import request from 'supertest';
import { SESSION_TOKEN_ISSUER, type SessionTokenIssuer } from '@identity/application/ports/session-token-issuer.js';
import { startE2eApp, type E2eApp } from './e2e-app.js';
import { DEFAULT_OWNER_ID, resetDb } from './default-owner-db.js';

const FAR_FUTURE = '2100-01-01T00:00:00.000Z';

/**
 * App real para os testes de finance de usuario unico: tudo que `http()` envia ja vai autenticado como o USUARIO
 * PADRAO (Ana, `DEFAULT_OWNER`), como o BFF faria com o cookie de sessao. `reset()` recria o usuario e a sessao.
 * Testes de acesso/isolamento usam startIdentityE2e e controlam as credenciais.
 */
export async function startFinanceE2e(
  now?: Date,
  overrides: { token: unknown; value: unknown }[] = [],
): Promise<E2eApp & { token: () => string }> {
  const base = await startE2eApp(now, overrides);
  const issuer = base.app.get<SessionTokenIssuer>(SESSION_TOKEN_ISSUER);
  const agent = request.agent(base.app.getHttpServer());
  let sessionCounter = 0;
  let currentToken = '';

  const signIn = async (): Promise<void> => {
    const { token, digest } = issuer.issue();
    await base.pool.query(
      `INSERT INTO sessions (id, user_id, token_digest, created_at, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, '2026-01-01T00:00:00.000Z'::timestamptz, $4::timestamptz)`,
      [`0b000000-0000-7000-8000-${String(++sessionCounter).padStart(12, '0')}`, DEFAULT_OWNER_ID, digest.value, FAR_FUTURE],
    );
    currentToken = token;
    agent.set('Authorization', `Bearer ${token}`);
  };

  await resetDb(base.pool);
  await signIn();
  return {
    ...base,
    token: () => currentToken,
    http: () => agent as unknown as ReturnType<typeof request>,
    reset: async () => {
      await resetDb(base.pool);
      await signIn();
    },
  };
}
