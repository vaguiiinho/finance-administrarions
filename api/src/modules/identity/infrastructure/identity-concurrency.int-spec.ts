import type pg from 'pg';
import { createPool, query } from '@test/support/db.js';
import { insertUser, resetAll } from '@test/support/owned-db.js';
import { buildIdentityInfra, type IdentityInfra } from '@test/support/identity-infra.js';
import { actorOf, outroAdmin, vagner, userUuid } from '@test/support/identity-builders.js';
import { FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';

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

const A = () => vagner();
const B = () => outroAdmin();
const ITERATIONS = 50;
/** O perdedor da corrida pode ver LAST_ADMIN, ou o ator ja inativo (401) ou ja rebaixado (403). */
const ACCEPTED_LOSS = ['LAST_ADMIN', 'UNAUTHENTICATED', 'FORBIDDEN'];

async function seedTwoAdmins() {
  await resetAll(pool);
  await insertUser(pool, { n: 4, name: 'Vagner', email: 'vagner@exemplo.com', role: 'ADMIN' });
  await insertUser(pool, { n: 5, name: 'Outro Admin', email: 'admin2@exemplo.com', role: 'ADMIN' });
}
const activeAdmins = async () =>
  Number((await query<{ n: string }>(pool, `SELECT count(*) AS n FROM users WHERE kind = 'REGULAR' AND role = 'ADMIN' AND status = 'ACTIVE'`))[0].n);

function outcome(r: PromiseSettledResult<unknown>): string {
  return r.status === 'fulfilled' ? 'OK' : (r.reason as { code?: string }).code ?? String(r.reason);
}

describe('T14/CA24/RNF15: o sistema nunca fica sem administrador ativo sob concorrencia', () => {
  it(`A inativa B enquanto B rebaixa A (${ITERATIONS}x): exatamente um sucesso, o outro LAST_ADMIN/401/403, >= 1 admin ativo`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      await seedTwoAdmins();
      const results = await Promise.allSettled([
        infra.deactivateUser.execute({ actor: actorOf(A()), id: B().id.value }),
        infra.updateUser.execute({ actor: actorOf(B()), id: A().id.value, name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' }),
      ]);
      const outcomes = results.map(outcome).sort();
      expect(outcomes.filter((o) => o === 'OK'), `iteracao ${i}: ${outcomes}`).toHaveLength(1);
      expect(ACCEPTED_LOSS).toContain(outcomes.find((o) => o !== 'OK'));
      expect(await activeAdmins(), `iteracao ${i}`).toBeGreaterThanOrEqual(1);
    }
  });

  it(`inativacoes cruzadas (A inativa B e B inativa A) ${ITERATIONS}x: um sucesso, >= 1 admin ativo`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      await seedTwoAdmins();
      const results = await Promise.allSettled([
        infra.deactivateUser.execute({ actor: actorOf(A()), id: B().id.value }),
        infra.deactivateUser.execute({ actor: actorOf(B()), id: A().id.value }),
      ]);
      const outcomes = results.map(outcome).sort();
      expect(outcomes.filter((o) => o === 'OK'), `iteracao ${i}: ${outcomes}`).toHaveLength(1);
      expect(ACCEPTED_LOSS).toContain(outcomes.find((o) => o !== 'OK'));
      expect(await activeAdmins(), `iteracao ${i}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('dois rebaixamentos cruzados (A rebaixa B e B rebaixa A) 20x: nunca zera os administradores', async () => {
    for (let i = 0; i < 20; i++) {
      await seedTwoAdmins();
      await Promise.allSettled([
        infra.updateUser.execute({ actor: actorOf(A()), id: B().id.value, name: 'Outro Admin', email: 'admin2@exemplo.com', role: 'USER' }),
        infra.updateUser.execute({ actor: actorOf(B()), id: A().id.value, name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' }),
      ]);
      expect(await activeAdmins(), `iteracao ${i}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('o unico administrador ativo nao consegue se rebaixar (422 LAST_ADMIN) no Postgres real', async () => {
    await resetAll(pool);
    await insertUser(pool, { n: 4, name: 'Vagner', email: 'vagner@exemplo.com', role: 'ADMIN' });
    await insertUser(pool, { n: 5, name: 'Outro Admin', email: 'admin2@exemplo.com', role: 'ADMIN', status: 'INACTIVE' });
    await expect(
      infra.updateUser.execute({ actor: actorOf(A()), id: A().id.value, name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' }),
    ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    expect(await activeAdmins()).toBe(1);
  });

  it('ator inexistente/inativo e revalidado DENTRO da transacao (sessao encerrada entre o guard e a escrita)', async () => {
    await seedTwoAdmins();
    await pool.query(`UPDATE users SET status = 'INACTIVE' WHERE id = $1`, [A().id.value]);
    await expect(infra.deactivateUser.execute({ actor: actorOf(A()), id: B().id.value })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    void userUuid;
  });
});

describe('Bootstrap concorrente (T12)', () => {
  const ENV = { ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'admin@exemplo.com', ADMIN_PASSWORD: 'Inicial123' };

  it('duas instancias subindo juntas: um created e um skipped, um unico administrador (10x)', async () => {
    for (let i = 0; i < 10; i++) {
      await resetAll(pool);
      const results = await Promise.all([infra.bootstrap().execute(ENV), infra.bootstrap().execute(ENV)]);
      expect(results.map((r) => r.status).sort(), `iteracao ${i}`).toEqual(['created', 'skipped']);
      expect(await query(pool, 'SELECT id FROM users')).toEqual([{ id: FIRST_ADMIN_ID }]);
    }
  });

  it('com o marcador: um provisioned e um skipped, o id continua o do marcador', async () => {
    await resetAll(pool);
    await insertUser(pool, { n: 1, id: FIRST_ADMIN_ID, kind: 'PENDING_FIRST_ADMIN', role: 'ADMIN', passwordHash: null, email: 'first-admin@finance.invalid', mustChangePassword: true });
    const results = await Promise.all([infra.bootstrap().execute(ENV), infra.bootstrap().execute(ENV)]);
    expect(results.map((r) => r.status).sort()).toEqual(['provisioned', 'skipped']);
    const rows = await query<{ id: string; kind: string; email: string }>(pool, 'SELECT id, kind, email FROM users');
    expect(rows).toEqual([{ id: FIRST_ADMIN_ID, kind: 'REGULAR', email: 'admin@exemplo.com' }]);
  });
});
