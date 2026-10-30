import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { databaseUrl, insertCard, insertEntry, cardEntry, query } from '@test/support/db.js';
import { buildIdentityInfra } from '@test/support/identity-infra.js';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { PrismaMonthlySummaryReadModel } from '@finance/infrastructure/read-models/monthly-summary-read-model.prisma.js';
import { ReferenceMonth } from '@finance/domain/billing/reference-month.js';
import { OwnerId } from '@finance/domain/owner/owner-id.js';
import { FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';
import { unwrap } from '@test/support/result.js';
import { insertUser } from '@test/support/owned-db.js';

/**
 * Migracao M2 sobre banco com dados PRE-EXISTENTES (ADR 0005 7.3, CA14). Cada teste usa um banco novo:
 * aplica so as migrations antigas (20261024*), grava dados "legados" por SQL e depois aplica as novas.
 */
const MIGRATIONS = resolve(process.cwd(), 'prisma/migrations');
const dirs = () => readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const legacy = () => dirs().filter((d) => d.startsWith('20261024'));
const newer = () => dirs().filter((d) => !d.startsWith('20261024'));
const sqlOf = (dir: string) => readFileSync(resolve(MIGRATIONS, dir, 'migration.sql'), 'utf8');

const admin = new pg.Pool({ connectionString: databaseUrl(), max: 2 });
const created: string[] = [];
const pools: pg.Pool[] = [];
afterAll(async () => {
  for (const p of pools) await p.end().catch(() => undefined);
  for (const name of created) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
});

async function freshDb(): Promise<{ pool: pg.Pool; url: string }> {
  const name = `mig_${randomBytes(4).toString('hex')}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  created.push(name);
  const url = new URL(databaseUrl());
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
  pools.push(pool);
  pool.on('error', () => undefined);
  for (const d of legacy()) await pool.query(sqlOf(d));
  return { pool, url: url.toString() };
}
const applyNew = async (pool: pg.Pool) => {
  for (const d of newer()) await pool.query(sqlOf(d));
};

async function seedLegacy(pool: pg.Pool) {
  await insertCard(pool, { n: 1, name: 'Nubank', closingDay: 25, dueDay: 5 });
  await insertCard(pool, { n: 2, name: 'Itau', closingDay: 10, dueDay: 17 });
  await insertEntry(pool, { n: 1, type: 'INCOME', amount: '5000.00', date: '2026-11-05', category: 'Salario' });
  await insertEntry(pool, { n: 2, amount: '600.00', date: '2026-11-07' });
  await insertEntry(pool, { n: 3, status: 'PENDING', amount: '40.00', date: '2026-11-08', paidAt: null });
  await insertEntry(pool, cardEntry(4, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '250.00' }));
}

describe('migracao de ownership com dados existentes (CA14, RF21)', () => {
  it('existem as migrations novas (identity + finance_ownership)', () => {
    expect(newer().some((d) => /create_identity/.test(d))).toBe(true);
    expect(newer().some((d) => /finance_ownership/.test(d))).toBe(true);
  });

  it('cria o marcador PENDING_FIRST_ADMIN com o id fixo e entrega TODOS os cartoes e lancamentos a ele', async () => {
    const { pool } = await freshDb();
    await seedLegacy(pool);
    await applyNew(pool);
    const users = await query<{ id: string; kind: string; role: string; status: string; password_hash: string | null; must_change_password: boolean }>(
      pool,
      'SELECT id, kind, role, status, password_hash, must_change_password FROM users',
    );
    expect(users).toEqual([
      { id: FIRST_ADMIN_ID, kind: 'PENDING_FIRST_ADMIN', role: 'ADMIN', status: 'ACTIVE', password_hash: null, must_change_password: true },
    ]);
    expect(await query(pool, 'SELECT 1 FROM cards WHERE user_id IS DISTINCT FROM $1', [FIRST_ADMIN_ID])).toHaveLength(0);
    expect(await query(pool, 'SELECT 1 FROM entries WHERE user_id IS DISTINCT FROM $1', [FIRST_ADMIN_ID])).toHaveLength(0);
    expect(await query(pool, 'SELECT 1 FROM cards')).toHaveLength(2);
    expect(await query(pool, 'SELECT 1 FROM entries')).toHaveLength(4);
    await pool.end();
  });

  it('user_id fica NOT NULL com FK; unicidade passa a ser (user_id, name_key) e o indice global sai', async () => {
    const { pool } = await freshDb();
    await seedLegacy(pool);
    await applyNew(pool);
    const nullable = await query<{ table_name: string; is_nullable: string }>(
      pool,
      `SELECT table_name, is_nullable FROM information_schema.columns WHERE column_name = 'user_id' AND table_name IN ('cards','entries')`,
    );
    expect(nullable.map((r) => r.is_nullable)).toEqual(['NO', 'NO']);
    const idx = (await query<{ indexname: string }>(pool, `SELECT indexname FROM pg_indexes WHERE tablename = 'cards'`)).map((r) => r.indexname);
    expect(idx).not.toContain('cards_name_key_uq');
    expect(idx).toContain('cards_owner_name_key_uq');
    // dois donos podem ter "Nubank"; o mesmo dono nao
    const other = await insertUser(pool, { n: 2, email: 'bruno@exemplo.com' });
    await pool.query(
      `INSERT INTO cards (id, user_id, name, name_key, closing_day, due_day, created_at, updated_at)
       VALUES ('c0000000-0000-7000-8000-000000000099', $1, 'Nubank', 'nubank', 1, 2, now(), now())`,
      [other],
    );
    await expect(
      pool.query(
        `INSERT INTO cards (id, user_id, name, name_key, closing_day, due_day, created_at, updated_at)
         VALUES ('c0000000-0000-7000-8000-000000000098', $1, 'Nubank', 'nubank', 1, 2, now(), now())`,
        [FIRST_ADMIN_ID],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await pool.end();
  });

  it('triggers de mesmo dono: lancamento com cartao de outro dono e troca de dono do cartao falham', async () => {
    const { pool } = await freshDb();
    await seedLegacy(pool);
    await applyNew(pool);
    const other = await insertUser(pool, { n: 2, email: 'bruno@exemplo.com' });
    await expect(
      pool.query(
        `INSERT INTO entries (id, user_id, type, description, category, category_key, "date", amount, payment_method, card_id,
                              closing_date, due_date, reference_month, status, paid_at, created_at, updated_at)
         VALUES ('e0000000-0000-7000-8000-000000000099', $1, 'EXPENSE', 'x', 'c', 'c', '2026-10-10', 10, 'CARD', 'c0000000-0000-7000-8000-000000000001',
                 '2026-10-25', '2026-11-05', '2026-11-01', 'PENDING', NULL, now(), now())`,
        [other],
      ),
    ).rejects.toBeDefined();
    await expect(pool.query(`UPDATE cards SET user_id = $1 WHERE id = 'c0000000-0000-7000-8000-000000000001'`, [other])).rejects.toBeDefined();
    await pool.end();
  });

  it('CA14: BootstrapFirstAdmin real provisiona o administrador mantendo o id e os totais ficam IGUAIS aos de antes da migracao', async () => {
    const { pool, url } = await freshDb();
    await seedLegacy(pool);
    const before = (
      await query<{ income: string; expenses: string }>(
        pool,
        `SELECT coalesce(sum(amount) FILTER (WHERE type='INCOME'),0)::text AS income,
                coalesce(sum(amount) FILTER (WHERE type='EXPENSE'),0)::text AS expenses
           FROM entries WHERE reference_month = '2026-11-01'`,
      )
    )[0];
    await applyNew(pool);

    const infra = await buildIdentityInfra(url);
    try {
      const result = await infra.bootstrap().execute({ ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'Admin@Exemplo.com', ADMIN_PASSWORD: 'Inicial123' });
      expect(result.status).toBe('provisioned');
      const [row] = await query<{ id: string; kind: string; email: string; must_change_password: boolean }>(pool, 'SELECT id, kind, email, must_change_password FROM users');
      expect(row).toEqual({ id: FIRST_ADMIN_ID, kind: 'REGULAR', email: 'admin@exemplo.com', must_change_password: true });
      expect(await query(pool, 'SELECT 1 FROM entries WHERE user_id = $1', [FIRST_ADMIN_ID])).toHaveLength(4);

      const summary = new PrismaMonthlySummaryReadModel(infra.prisma as PrismaService);
      const totals = await (summary as unknown as { summary(o: unknown, m: unknown): Promise<{ income: { toString(): string }; paidExpenses: { toString(): string }; pendingExpenses: { toString(): string } }> }).summary(
        unwrap(OwnerId.create(FIRST_ADMIN_ID)),
        unwrap(ReferenceMonth.parse('2026-11')),
      );
      expect(Number(totals.income.toString())).toBe(Number(before.income));
      expect(Number(totals.paidExpenses.toString()) + Number(totals.pendingExpenses.toString())).toBe(Number(before.expenses));
    } finally {
      await infra.close();
      await pool.end();
    }
  });

  it('banco SEM dados: a migracao nao cria marcador; o bootstrap cria o administrador (created)', async () => {
    const { pool, url } = await freshDb();
    await applyNew(pool);
    expect(await query(pool, 'SELECT 1 FROM users')).toHaveLength(0);
    const infra = await buildIdentityInfra(url);
    try {
      expect((await infra.bootstrap().execute({ ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'admin@exemplo.com', ADMIN_PASSWORD: 'Inicial123' })).status).toBe('created');
    } finally {
      await infra.close();
      await pool.end();
    }
  });

  it('rodar as migrations novas nao deixa nenhum cartao ou lancamento sem dono e os dados legados nao viram demo', async () => {
    const { pool } = await freshDb();
    await seedLegacy(pool);
    await applyNew(pool);
    expect(await query(pool, `SELECT 1 FROM cards c JOIN users u ON u.id = c.user_id WHERE u.kind = 'DEMO'`)).toHaveLength(0);
    expect(await query(pool, `SELECT 1 FROM entries e JOIN users u ON u.id = e.user_id WHERE u.kind = 'DEMO'`)).toHaveLength(0);
    await pool.end();
  });
});
