import type pg from 'pg';
import { createPool, query } from '@test/support/db.js';
import { insertOwnedEntry, insertSession, resetAll } from '@test/support/owned-db.js';
import { buildIdentityInfra, type IdentityInfra } from '@test/support/identity-infra.js';
import { NOW } from '@test/support/builders.js';
import { ana } from '@test/support/identity-builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID } from '@test/support/showcase-builders.js';
import { EnsureShowcaseAccount } from '@identity/application/use-cases/bootstrap/ensure-showcase-account.js';

let pool: pg.Pool;
let infra: IdentityInfra;
beforeAll(async () => {
  pool = createPool();
  infra = await buildIdentityInfra();
});
afterAll(async () => {
  await infra.close();
  await pool.end();
});
beforeEach(() => resetAll(pool));

describe('EnsureShowcaseAccount sobre Postgres real (RF36, CA49)', () => {
  const useCase = () => new EnsureShowcaseAccount(infra.uow, infra.hasher, infra.clock, infra.publisher);
  const accounts = () => query<{ id: string; role: string; email: string; status: string; password_hash: string }>(
    pool,
    `SELECT id, role, email, status, password_hash FROM users WHERE kind = 'SHOWCASE'`,
  );

  it('duas execucoes seguidas, com lancamentos criados entre elas: uma unica conta USER e os lancamentos preservados', async () => {
    expect(await useCase().execute({ password: 'demo' })).toEqual({ status: 'created' });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, description: 'Criado pelo visitante' });
    expect(await useCase().execute({ password: 'demo' })).toEqual({ status: 'unchanged' });
    const rows = await accounts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: SHOWCASE_ID, role: 'USER', email: SHOWCASE_EMAIL, status: 'ACTIVE' });
    expect(rows[0].password_hash).toBe('$fake$demo');
    const [{ count }] = await query<{ count: string }>(pool, 'SELECT count(*) FROM entries WHERE user_id = $1::uuid', [SHOWCASE_ID]);
    expect(count).toBe('1');
  });

  it('desabilitar: conta inativa, sessoes encerradas, usuario e lancamentos nao apagados', async () => {
    await useCase().execute({ password: 'demo' });
    await insertSession(pool, { n: 1, userId: SHOWCASE_ID, createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 86_400_000).toISOString() });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 2 });
    expect(await useCase().execute({ password: null })).toEqual({ status: 'disabled' });
    expect((await accounts())[0].status).toBe('INACTIVE');
    const [{ count }] = await query<{ count: string }>(pool, 'SELECT count(*) FROM sessions WHERE user_id = $1::uuid', [SHOWCASE_ID]);
    expect(count).toBe('0');
    const [{ count: entries }] = await query<{ count: string }>(pool, 'SELECT count(*) FROM entries');
    expect(entries).toBe('1');
  });

  it('e-mail tomado por usuario REGULAR -> conflict, e o usuario REGULAR fica intacto', async () => {
    await infra.users.insert(ana({ email: SHOWCASE_EMAIL }));
    expect(await useCase().execute({ password: 'demo' })).toEqual({ status: 'conflict' });
    expect(await accounts()).toHaveLength(0);
  });
});
