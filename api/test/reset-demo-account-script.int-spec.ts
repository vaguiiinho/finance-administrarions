import { inject } from 'vitest';
import type pg from 'pg';
import { createPool, query } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertSession, insertUser, resetAll } from '@test/support/owned-db.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID } from '@test/support/showcase-builders.js';

/**
 * Execucao manual (`npm run demo:reset`, ADR 0013 5.7; RF17, CA25): executa o script real contra o Postgres do container
 * e verifica a saida (linha legivel + JSON com origin/accountState/outcome/deleted/restored/revokedSessions) e o codigo de saida.
 */
const ANA = '0a000000-0000-7000-8000-000000000001';
let pool: pg.Pool;
let out: string[];
let err: string[];
beforeAll(() => {
  pool = createPool();
});
afterAll(() => pool.end());
beforeEach(async () => {
  await resetAll(pool);
  process.exitCode = undefined;
  out = [];
  err = [];
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void err.push(a.map(String).join(' ')));
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => (err.push(String(chunk)), true)) as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function runScript(): Promise<void> {
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.SESSION_TOKEN_SECRET ??= 'e2e-session-secret-e2e-session-secret-0123456789';
  vi.resetModules();
  await import('../src/bootstrap/scripts/reset-demo-account.js');
}
const jsonLine = (): Record<string, any> => {
  for (const line of out) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  }
  throw new Error(`nenhuma linha JSON na saida do script: ${JSON.stringify(out)}`);
};
const seedAccount = async (status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') => {
  await insertUser(pool, { n: 50, id: SHOWCASE_ID, kind: 'SHOWCASE', status, passwordHash: '$x', email: SHOWCASE_EMAIL, name: 'Conta de demonstração' });
};
const count = async (table: string, userId: string) => Number((await query<{ c: string }>(pool, `SELECT count(*) AS c FROM ${table} WHERE user_id = $1::uuid`, [userId]))[0].c);

describe('npm run demo:reset: execucao manual (CA25)', () => {
  it('conta ativa com dados de visitantes: volta ao estado inicial, devolve as quantidades e sai com codigo 0', async () => {
    await seedAccount();
    await insertOwnedCard(pool, SHOWCASE_ID, { n: 1, name: 'Cartao X' });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, description: 'Teste visitante' });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 2, description: 'Outro teste' });
    await runScript();

    const result = jsonLine();
    expect(result).toMatchObject({ origin: 'manual', accountState: 'active', outcome: 'reset', revokedSessions: 0 });
    expect(result.deleted).toEqual({ entries: 2, cards: 1 });
    expect(result.restored.cards).toBe(2);
    expect(result.restored.entries).toBeGreaterThan(10);
    expect(process.exitCode ?? 0).toBe(0);

    expect(await count('cards', SHOWCASE_ID)).toBe(2);
    const descriptions = (await query<{ description: string }>(pool, 'SELECT description FROM entries WHERE user_id = $1::uuid', [SHOWCASE_ID])).map((r) => r.description);
    expect(descriptions).not.toContain('Teste visitante');
    expect(descriptions).toHaveLength(result.restored.entries);
  });

  it('roda sempre (condition always), mesmo logo depois de outra redefinicao: o que foi criado depois some', async () => {
    await seedAccount();
    await runScript();
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 9100, description: 'Criado depois da redefinicao' });
    out.length = 0;
    await runScript();
    expect(jsonLine()).toMatchObject({ origin: 'manual', outcome: 'reset' });
    const descriptions = (await query<{ description: string }>(pool, 'SELECT description FROM entries WHERE user_id = $1::uuid', [SHOWCASE_ID])).map((r) => r.description);
    expect(descriptions).not.toContain('Criado depois da redefinicao');
  });

  it('CA24: as sessoes da conta demo continuam (mesmo numero); nenhuma e revogada', async () => {
    await seedAccount();
    await insertSession(pool, { n: 1, userId: SHOWCASE_ID, createdAt: '2026-11-14T10:00:00.000Z', expiresAt: '2099-01-01T10:00:00.000Z' });
    await insertSession(pool, { n: 2, userId: SHOWCASE_ID, createdAt: '2026-11-14T11:00:00.000Z', expiresAt: '2099-01-01T11:00:00.000Z' });
    await runScript();
    expect(await count('sessions', SHOWCASE_ID)).toBe(2);
    expect(jsonLine().revokedSessions).toBe(0);
  });

  it('CA23: so a conta demo e afetada (Ana intacta)', async () => {
    await seedAccount();
    await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
    await insertOwnedCard(pool, ANA, { n: 201 });
    for (let i = 0; i < 3; i++) await insertOwnedEntry(pool, ANA, { n: 210 + i });
    await runScript();
    expect(await count('entries', ANA)).toBe(3);
    expect(await count('cards', ANA)).toBe(1);
  });

  it('CA28: conta INATIVA: so apaga (nao grava o dataset), nao reativa, sai com codigo 0 e mostra restored zerado', async () => {
    await seedAccount('INACTIVE');
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1 });
    await runScript();
    expect(jsonLine()).toMatchObject({ accountState: 'inactive', outcome: 'reset', deleted: { entries: 1, cards: 0 }, restored: { entries: 0, cards: 0 } });
    expect(await count('entries', SHOWCASE_ID)).toBe(0);
    expect((await query<{ status: string }>(pool, 'SELECT status FROM users WHERE id = $1::uuid', [SHOWCASE_ID]))[0].status).toBe('INACTIVE');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('conta AUSENTE: nada e feito, outcome skipped, codigo 0 (nao e falha)', async () => {
    await runScript();
    expect(jsonLine()).toMatchObject({ origin: 'manual', accountState: 'absent', outcome: 'skipped' });
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('imprime tambem uma linha legivel (nao so JSON) e nunca a senha nem conteudo de lancamentos', async () => {
    await seedAccount();
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, description: 'Descricao sensivel do visitante' });
    await runScript();
    expect(out.some((l) => !l.trim().startsWith('{') && l.trim().length > 0)).toBe(true);
    const everything = [...out, ...err].join('\n');
    expect(everything).not.toContain('Descricao sensivel do visitante');
    expect(everything).not.toMatch(/\$x|SESSION_TOKEN_SECRET|e2e-session-secret/);
  });

  it('falha de banco: sai com codigo 1, a conta fica como estava (tudo ou nada) e a mensagem crua do banco nao e impressa', async () => {
    await seedAccount();
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, description: 'Continua aqui' });
    await pool.query(`CREATE OR REPLACE FUNCTION fail_entry_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha induzida pelo teste'; END $$ LANGUAGE plpgsql`);
    await pool.query('CREATE TRIGGER fail_entry_insert BEFORE INSERT ON entries FOR EACH ROW EXECUTE FUNCTION fail_entry_insert()');
    try {
      await runScript();
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS fail_entry_insert ON entries');
      await pool.query('DROP FUNCTION IF EXISTS fail_entry_insert()');
    }
    expect(process.exitCode).toBe(1);
    const descriptions = (await query<{ description: string }>(pool, 'SELECT description FROM entries WHERE user_id = $1::uuid', [SHOWCASE_ID])).map((r) => r.description);
    expect(descriptions).toEqual(['Continua aqui']);
    expect([...out, ...err].join('\n')).not.toContain('falha induzida pelo teste');
  });
});
