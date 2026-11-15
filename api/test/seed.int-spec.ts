import { inject } from 'vitest';
import type pg from 'pg';
import { createPool, query } from '@test/support/db.js';
import { insertOwnedEntry, insertUser, resetAll } from '@test/support/owned-db.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID } from '@test/support/showcase-builders.js';

/**
 * Seed (`prisma db seed`, ADR 0013 5.8): EnsureShowcaseAccount -> estado -> ResetOwnerData(sample-stale). Executa o
 * script real contra o Postgres do container (CA05, CA17, RF04, RF14). Sem EnsureDemoUser nem RefreshDemoDataset.
 */
const D1 = '01900000-0000-7000-8000-0000000000d1';
let pool: pg.Pool;
beforeAll(() => {
  pool = createPool();
});
afterAll(() => pool.end());
beforeEach(async () => {
  await resetAll(pool);
  vi.resetModules();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SHOWCASE_ACCOUNT_PASSWORD;
});

async function runSeed(password: string | null): Promise<void> {
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.SESSION_TOKEN_SECRET ??= 'e2e-session-secret-e2e-session-secret-0123456789';
  if (password === null) delete process.env.SHOWCASE_ACCOUNT_PASSWORD;
  else process.env.SHOWCASE_ACCOUNT_PASSWORD = password;
  vi.resetModules();
  await import('../src/bootstrap/seed/run-seed.js');
}

/** Mes corrente em America/Sao_Paulo (o seed usa o relogio real). */
const currentSpMonth = (): { y: number; m: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return { y: Number(parts.find((p) => p.type === 'year')!.value), m: Number(parts.find((p) => p.type === 'month')!.value) };
};
const ymAdd = (y: number, m: number, delta: number): string => {
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
};
const refMonths = async () =>
  (await query<{ m: string }>(pool, `SELECT DISTINCT to_char(reference_month, 'YYYY-MM') AS m FROM entries WHERE user_id = $1::uuid ORDER BY 1`, [SHOWCASE_ID])).map((r) => r.m);
const count = async (table: string, userId: string) => Number((await query<{ c: string }>(pool, `SELECT count(*) AS c FROM ${table} WHERE user_id = $1::uuid`, [userId]))[0].c);

describe('seed com SHOWCASE_ACCOUNT_PASSWORD=demo (CA17, RF14)', () => {
  it('provisiona a conta demo ativa e grava o dataset de exemplo: 2 cartoes e lancamentos dos 12 meses ate o mes corrente de SP, mais a fatura do seguinte', async () => {
    await runSeed('demo');
    const [account] = await query<{ status: string; kind: string; email: string }>(pool, 'SELECT status, kind, email FROM users WHERE id = $1::uuid', [SHOWCASE_ID]);
    expect(account).toEqual({ status: 'ACTIVE', kind: 'SHOWCASE', email: SHOWCASE_EMAIL });
    expect(await count('cards', SHOWCASE_ID)).toBe(2);
    const { y, m } = currentSpMonth();
    const months = await refMonths();
    for (let i = -11; i <= 0; i++) expect(months, ymAdd(y, m, i)).toContain(ymAdd(y, m, i));
    expect(months).toContain(ymAdd(y, m, 1));
    expect(months).not.toContain(ymAdd(y, m, -12));
    expect(months).not.toContain(ymAdd(y, m, 2));
  });

  it('registra o controle da redefinicao (owner_data_resets) com ancora no mes corrente e a versao do dataset', async () => {
    await runSeed('demo');
    const [row] = await query<{ anchor_month: Date; template_version: number }>(pool, 'SELECT anchor_month, template_version FROM owner_data_resets WHERE owner_id = $1::uuid', [SHOWCASE_ID]);
    const { y, m } = currentSpMonth();
    expect(new Date(row.anchor_month).toISOString().slice(0, 7)).toBe(`${y}-${String(m).padStart(2, '0')}`);
    expect(row.template_version).toBe(1);
  });

  it('CA05/RF04: nao cria o usuario DEMO_USER_ID nem dados dele', async () => {
    await runSeed('demo');
    expect(await query(pool, 'SELECT 1 FROM users WHERE id = $1::uuid', [D1])).toHaveLength(0);
    expect(await count('entries', D1)).toBe(0);
    expect(await count('cards', D1)).toBe(0);
    expect(await query(pool, `SELECT 1 FROM users WHERE kind::text = 'DEMO'`)).toHaveLength(0);
  });

  it('idempotente: rodar o seed de novo (deploy) nao duplica nem apaga o que um visitante criou (sample-stale)', async () => {
    await runSeed('demo');
    const cards = await count('cards', SHOWCASE_ID);
    const entries = await count('entries', SHOWCASE_ID);
    expect(cards).toBe(2);
    expect(entries).toBeGreaterThan(10);
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 9100, description: 'Criado pelo visitante antes do deploy' });
    await runSeed('demo');
    expect(await count('cards', SHOWCASE_ID)).toBe(cards);
    expect(await count('entries', SHOWCASE_ID)).toBe(entries + 1);
  });

  it('o dataset nunca e gravado em outro usuario (Ana intacta)', async () => {
    await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
    await insertOwnedEntry(pool, '0a000000-0000-7000-8000-000000000001', { n: 1 });
    await runSeed('demo');
    expect(await count('entries', '0a000000-0000-7000-8000-000000000001')).toBe(1);
    expect(await count('cards', '0a000000-0000-7000-8000-000000000001')).toBe(0);
  });
});

describe('seed com a conta demo desabilitada (RF14, B4)', () => {
  it('env vazia num banco novo: nao cria conta nem dados', async () => {
    await runSeed('');
    expect(await query(pool, 'SELECT 1 FROM users WHERE id = $1::uuid', [SHOWCASE_ID])).toHaveLength(0);
    expect(await count('entries', SHOWCASE_ID)).toBe(0);
  });

  it('env removida depois de habilitada: a conta fica INATIVA, mas os dados nao sao apagados nem regravados', async () => {
    await runSeed('demo');
    const entries = await count('entries', SHOWCASE_ID);
    await runSeed(null);
    const [account] = await query<{ status: string }>(pool, 'SELECT status FROM users WHERE id = $1::uuid', [SHOWCASE_ID]);
    expect(account.status).toBe('INACTIVE');
    expect(await count('entries', SHOWCASE_ID)).toBe(entries);
  });
});
