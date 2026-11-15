import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { databaseUrl, query, expectCheckViolation } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertSession, insertUser } from '@test/support/owned-db.js';

/**
 * Migrations M1 (exclusao unica da demonstracao publica, RF05) e M2 (demo_datasets -> owner_data_resets) do ADR 0013 7.2.
 * Cada teste usa um banco novo com as migrations ANTERIORES a M1 aplicadas, grava dados "de producao" por SQL e
 * aplica M1 (e M2) em seguida, como o `prisma migrate deploy` faria.
 */
const MIGRATIONS = resolve(process.cwd(), 'prisma/migrations');
const dirs = () => readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const M1_PREFIX = '20261114000001';
const M2_PREFIX = '20261114000002';
const before = () => dirs().filter((d) => d < M1_PREFIX);
const sqlOf = (dir: string) => readFileSync(resolve(MIGRATIONS, dir, 'migration.sql'), 'utf8');
const migration = (prefix: string): string => {
  const dir = dirs().find((d) => d.startsWith(prefix));
  if (!dir) throw new Error(`migration ${prefix}_* inexistente em prisma/migrations (ADR 0013 7.2)`);
  return sqlOf(dir);
};

const D1 = '01900000-0000-7000-8000-0000000000d1'; // usuario da demonstracao publica (sai)
const D2 = '01900000-0000-7000-8000-0000000000d2'; // conta demo (fica)
const ADMIN = '01900000-0000-7000-8000-0000000000a1';
const ANA = '0a000000-0000-7000-8000-000000000001';

const admin = new pg.Pool({ connectionString: databaseUrl(), max: 2 });
const created: string[] = [];
const pools: pg.Pool[] = [];
afterAll(async () => {
  for (const p of pools) await p.end().catch(() => undefined);
  for (const name of created) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
});

async function freshDb(): Promise<pg.Pool> {
  const name = `mig_demo_${randomBytes(4).toString('hex')}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  created.push(name);
  const url = new URL(databaseUrl());
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
  pools.push(pool);
  pool.on('error', () => undefined);
  for (const d of before()) await pool.query(sqlOf(d));
  return pool;
}

const count = async (pool: pg.Pool, table: string, where = 'true', params: unknown[] = []) =>
  Number((await query<{ c: string }>(pool, `SELECT count(*) AS c FROM ${table} WHERE ${where}`, params))[0].c);

/** Estado "de producao": demonstracao publica com 2 cartoes e 3 lancamentos + conta demo (3) + Ana (10) + admin (2). */
async function seedProduction(pool: pg.Pool): Promise<void> {
  await insertUser(pool, { n: 90, id: D1, kind: 'DEMO', passwordHash: null, name: 'Demonstração', email: 'demo@finance.invalid' });
  await insertUser(pool, { n: 50, id: D2, kind: 'SHOWCASE', passwordHash: '$x', name: 'Conta de demonstração', email: 'demo@showcase.invalid' });
  await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
  await insertUser(pool, { n: 91, id: ADMIN, name: 'Admin', email: 'admin@exemplo.com', role: 'ADMIN' });
  await insertOwnedCard(pool, D1, { n: 1, name: 'Azul' });
  await insertOwnedCard(pool, D1, { n: 2, name: 'Roxo' });
  await insertOwnedEntry(pool, D1, { n: 1, description: 'Demo 1' });
  await insertOwnedEntry(pool, D1, { n: 2, description: 'Demo 2', cardN: 1, paymentMethod: 'CARD', status: 'PENDING', paidAt: null, closingDate: '2026-11-10', dueDate: '2026-11-20', referenceMonth: '2026-11-01' });
  await insertOwnedEntry(pool, D1, { n: 3, description: 'Demo 3', cardN: 2, paymentMethod: 'CARD', status: 'PENDING', paidAt: null, closingDate: '2026-11-25', dueDate: '2026-12-05', referenceMonth: '2026-12-01' });
  for (let i = 0; i < 3; i++) await insertOwnedEntry(pool, D2, { n: 100 + i, description: `Showcase ${i}` });
  for (let i = 0; i < 10; i++) await insertOwnedEntry(pool, ANA, { n: 200 + i, description: `Ana ${i}` });
  for (let i = 0; i < 2; i++) await insertOwnedEntry(pool, ADMIN, { n: 300 + i, description: `Admin ${i}` });
  await insertSession(pool, { n: 1, userId: D1, createdAt: '2026-11-01T10:00:00.000Z', expiresAt: '2026-11-02T10:00:00.000Z' });
  await insertSession(pool, { n: 2, userId: D2, createdAt: '2026-11-01T10:00:00.000Z', expiresAt: '2026-12-02T10:00:00.000Z' });
  await pool.query(`INSERT INTO demo_datasets (owner_id, anchor_month, template_version, refreshed_at) VALUES ($1::uuid, '2026-11-01', 1, '2026-11-14T06:00:00Z')`, [D1]);
}

const snapshotOthers = async (pool: pg.Pool) => ({
  users: await query(pool, 'SELECT id, kind, email, status, password_hash FROM users WHERE id <> $1::uuid ORDER BY id', [D1]),
  entries: await query(pool, 'SELECT id, user_id, description FROM entries WHERE user_id <> $1::uuid ORDER BY id', [D1]),
  cards: await query(pool, 'SELECT id, user_id, name FROM cards WHERE user_id <> $1::uuid ORDER BY id', [D1]),
  sessions: await query(pool, 'SELECT id, user_id FROM sessions WHERE user_id <> $1::uuid ORDER BY id', [D1]),
});

describe('M1: exclusao unica da demonstracao publica (RF05, CA03, CA04)', () => {
  it('a migration M1 existe', () => {
    expect(dirs().some((d) => d.startsWith(M1_PREFIX))).toBe(true);
  });

  it('CA03: apaga lancamentos, cartoes, sessoes, linha de demo_datasets e o usuario DEMO_USER_ID', async () => {
    const pool = await freshDb();
    await seedProduction(pool);
    await pool.query(migration(M1_PREFIX));
    expect(await count(pool, 'users', 'id = $1::uuid', [D1])).toBe(0);
    expect(await count(pool, 'entries', 'user_id = $1::uuid', [D1])).toBe(0);
    expect(await count(pool, 'cards', 'user_id = $1::uuid', [D1])).toBe(0);
    expect(await count(pool, 'sessions', 'user_id = $1::uuid', [D1])).toBe(0);
    expect(await count(pool, 'demo_datasets', 'owner_id = $1::uuid', [D1])).toBe(0);
  });

  it('CA03: os 3 lancamentos da conta demo, os 10 de Ana e os 2 do admin continuam intactos; nenhuma outra tabela de dono muda', async () => {
    const pool = await freshDb();
    await seedProduction(pool);
    const others = await snapshotOthers(pool);
    await pool.query(migration(M1_PREFIX));
    expect(await count(pool, 'entries', 'user_id = $1::uuid', [D2])).toBe(3);
    expect(await count(pool, 'entries', 'user_id = $1::uuid', [ANA])).toBe(10);
    expect(await count(pool, 'entries', 'user_id = $1::uuid', [ADMIN])).toBe(2);
    expect(await snapshotOthers(pool)).toEqual(others);
  });

  it('CA04: num banco em que DEMO_USER_ID nunca existiu, roda sem erro e nao altera nada', async () => {
    const pool = await freshDb();
    await insertUser(pool, { n: 50, id: D2, kind: 'SHOWCASE', passwordHash: '$x', name: 'Conta de demonstração', email: 'demo@showcase.invalid' });
    await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
    await insertOwnedEntry(pool, ANA, { n: 1 });
    const others = await snapshotOthers(pool);
    await expect(pool.query(migration(M1_PREFIX))).resolves.toBeDefined();
    expect(await snapshotOthers(pool)).toEqual(others);
  });

  it('CA04: ja executada -> a parte de dados roda de novo sem erro e sem alterar nada (o CHECK novo e recriado)', async () => {
    const pool = await freshDb();
    await seedProduction(pool);
    await pool.query(migration(M1_PREFIX));
    const after = await snapshotOthers(pool);
    // O ADD CONSTRAINT da propria migration nao e re-executavel por natureza; o que precisa ser idempotente sao os DELETEs.
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_kind_not_demo_chk');
    await expect(pool.query(migration(M1_PREFIX))).resolves.toBeDefined();
    expect(await snapshotOthers(pool)).toEqual(after);
  });

  it('o CHECK users_demo_chk sai e users_kind_not_demo_chk passa a impedir kind = DEMO (T4)', async () => {
    const pool = await freshDb();
    await seedProduction(pool);
    await pool.query(migration(M1_PREFIX));
    const names = (await query<{ conname: string }>(pool, `SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass`)).map((r) => r.conname);
    expect(names).not.toContain('users_demo_chk');
    expect(names).toContain('users_kind_not_demo_chk');
    await expectCheckViolation(insertUser(pool, { n: 70, kind: 'DEMO', passwordHash: null, email: 'outro-demo@finance.invalid' }));
  });

  it('o valor DEMO continua no enum user_kind (nao e removivel sem recriar o tipo)', async () => {
    const pool = await freshDb();
    await pool.query(migration(M1_PREFIX));
    const labels = (await query<{ enumlabel: string }>(pool, `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_kind'`)).map((r) => r.enumlabel);
    expect(labels).toContain('DEMO');
  });

  it('a conta demo (SHOWCASE) continua podendo ser inserida (users_showcase_chk intacto)', async () => {
    const pool = await freshDb();
    await pool.query(migration(M1_PREFIX));
    await expect(insertUser(pool, { n: 50, id: D2, kind: 'SHOWCASE', passwordHash: '$x', email: 'demo@showcase.invalid' })).resolves.toBe(D2);
  });
});

describe('M2: demo_datasets -> owner_data_resets (ADR 0013 7.2)', () => {
  const upToM2 = async (pool: pg.Pool) => {
    await pool.query(migration(M1_PREFIX));
    await pool.query(migration(M2_PREFIX));
  };

  it('a migration M2 existe', () => {
    expect(dirs().some((d) => d.startsWith(M2_PREFIX))).toBe(true);
  });

  it('a tabela passa a se chamar owner_data_resets e demo_datasets some', async () => {
    const pool = await freshDb();
    await upToM2(pool);
    const tables = (await query<{ tablename: string }>(pool, `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).map((r) => r.tablename);
    expect(tables).toContain('owner_data_resets');
    expect(tables).not.toContain('demo_datasets');
  });

  it('colunas: last_reset_at (era refreshed_at); anchor_month e template_version anulaveis', async () => {
    const pool = await freshDb();
    await upToM2(pool);
    const cols = await query<{ column_name: string; is_nullable: string }>(
      pool,
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'owner_data_resets' ORDER BY column_name`,
    );
    const byName = Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]));
    expect(Object.keys(byName).sort()).toEqual(['anchor_month', 'last_reset_at', 'owner_id', 'template_version']);
    expect(byName.anchor_month).toBe('YES');
    expect(byName.template_version).toBe('YES');
    expect(byName.last_reset_at).toBe('NO');
  });

  it('CHECK de amostra: ancora e versao nascem juntas ou nenhuma das duas', async () => {
    const pool = await freshDb();
    await upToM2(pool);
    await insertUser(pool, { n: 50, id: D2, kind: 'SHOWCASE', passwordHash: '$x', email: 'demo@showcase.invalid' });
    await expectCheckViolation(pool.query(`INSERT INTO owner_data_resets (owner_id, anchor_month, template_version, last_reset_at) VALUES ($1::uuid, NULL, 1, now())`, [D2]));
    await expectCheckViolation(pool.query(`INSERT INTO owner_data_resets (owner_id, anchor_month, template_version, last_reset_at) VALUES ($1::uuid, '2026-11-01', NULL, now())`, [D2]));
    await pool.query(`INSERT INTO owner_data_resets (owner_id, anchor_month, template_version, last_reset_at) VALUES ($1::uuid, NULL, NULL, now())`, [D2]);
    expect(await count(pool, 'owner_data_resets')).toBe(1);
  });

  it('FK para users com ON DELETE CASCADE: apagar o usuario apaga o controle; owner inexistente e recusado', async () => {
    const pool = await freshDb();
    await upToM2(pool);
    await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
    await pool.query(`INSERT INTO owner_data_resets (owner_id, anchor_month, template_version, last_reset_at) VALUES ($1::uuid, '2026-11-01', 1, now())`, [ANA]);
    await expect(
      pool.query(`INSERT INTO owner_data_resets (owner_id, anchor_month, template_version, last_reset_at) VALUES ('0a000000-0000-7000-8000-0000000000ff'::uuid, '2026-11-01', 1, now())`),
    ).rejects.toMatchObject({ code: '23503' });
    await pool.query('DELETE FROM users WHERE id = $1::uuid', [ANA]);
    expect(await count(pool, 'owner_data_resets')).toBe(0);
  });

  it('linhas orfas (sem usuario) sao descartadas e as de usuarios existentes sao preservadas com last_reset_at = refreshed_at', async () => {
    const pool = await freshDb();
    await insertUser(pool, { n: 50, id: D2, kind: 'SHOWCASE', passwordHash: '$x', email: 'demo@showcase.invalid' });
    await pool.query(`INSERT INTO demo_datasets (owner_id, anchor_month, template_version, refreshed_at) VALUES ($1::uuid, '2026-10-01', 1, '2026-11-14T06:00:00Z')`, [D2]);
    await pool.query(`INSERT INTO demo_datasets (owner_id, anchor_month, template_version, refreshed_at) VALUES ('0a000000-0000-7000-8000-0000000000ee'::uuid, '2026-10-01', 1, '2026-11-14T06:00:00Z')`);
    await upToM2(pool);
    const rows = await query<{ owner_id: string; anchor_month: Date; template_version: number; last_reset_at: Date }>(pool, 'SELECT * FROM owner_data_resets');
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_id).toBe(D2);
    expect(rows[0].template_version).toBe(1);
    expect(new Date(rows[0].last_reset_at).toISOString()).toBe('2026-11-14T06:00:00.000Z');
  });

  it('depois de M1 + M2 a linha do DEMO_USER_ID nao existe em lugar nenhum (CA05)', async () => {
    const pool = await freshDb();
    await seedProduction(pool);
    await upToM2(pool);
    expect(await count(pool, 'owner_data_resets', 'owner_id = $1::uuid', [D1])).toBe(0);
    expect(await count(pool, 'users', 'id = $1::uuid', [D1])).toBe(0);
  });
});
