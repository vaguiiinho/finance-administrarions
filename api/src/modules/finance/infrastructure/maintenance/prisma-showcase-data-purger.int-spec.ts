import { inject } from 'vitest';
import type pg from 'pg';
import { createPool, query } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertUser, resetAll } from '@test/support/owned-db.js';
import { unwrap } from '@test/support/result.js';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import { OwnerId } from '@finance/domain/owner/owner-id.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID } from '@test/support/showcase-builders.js';
import { PrismaShowcaseDataPurger } from './prisma-showcase-data-purger.js';

/** CONTRATO ASSUMIDO: `new PrismaShowcaseDataPurger(prisma)` em `finance/infrastructure/maintenance/` (ADR 0011 7.3). */
let pool: pg.Pool;
let prisma: PrismaService;
let purger: PrismaShowcaseDataPurger;
const owner = (id: string) => unwrap<OwnerId>(OwnerId.create(id));
const CUTOFF = new Date('2026-11-03T06:00:00.000Z'); // 03:00 de Sao Paulo
const before = '2026-11-02T20:00:00.000Z';
const after = '2026-11-03T09:00:00.000Z';
const ANA_ID = '0a000000-0000-7000-8000-000000000001';

beforeAll(async () => {
  pool = createPool();
  process.env.DATABASE_URL = inject('databaseUrl');
  prisma = new PrismaService();
  await prisma.$connect();
  purger = new PrismaShowcaseDataPurger(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});
beforeEach(async () => {
  await resetAll(pool);
  await insertUser(pool, { n: 50, id: SHOWCASE_ID, kind: 'SHOWCASE' as never, email: SHOWCASE_EMAIL, passwordHash: '$x' });
  await insertUser(pool, { n: 1 });
  await insertUser(pool, { n: 90, id: DEMO_USER_ID, kind: 'DEMO', email: 'demo@finance.invalid' });
});

const count = async (table: 'entries' | 'cards', userId: string) =>
  Number((await query<{ c: string }>(pool, `SELECT count(*) AS c FROM ${table} WHERE user_id = $1::uuid`, [userId]))[0].c);

describe('PrismaShowcaseDataPurger.purgeCreatedBefore (B7, B9)', () => {
  it('apaga os lancamentos do dono anteriores ao corte e mantem os posteriores', async () => {
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, createdAt: before });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 2, createdAt: '2026-11-03T05:59:00.000Z' }); // 02:59 em SP: apagado
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 3, createdAt: after });
    const result = await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF);
    expect(result).toEqual({ entries: 2, cards: 0 });
    expect(await count('entries', SHOWCASE_ID)).toBe(1);
  });

  it('lancamento criado exatamente no corte NAO e apagado (estritamente anterior)', async () => {
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, createdAt: CUTOFF.toISOString() });
    expect((await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF)).entries).toBe(0);
  });

  it('apaga cartao antigo, inclusive o que tinha lancamentos antigos (apagados na mesma transacao)', async () => {
    await insertOwnedCard(pool, SHOWCASE_ID, { n: 1, createdAt: before });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, cardN: 1, paymentMethod: 'CARD', createdAt: before, closingDate: '2026-11-10', dueDate: '2026-11-20', referenceMonth: '2026-11-01' });
    expect(await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF)).toEqual({ entries: 1, cards: 1 });
    expect(await count('cards', SHOWCASE_ID)).toBe(0);
  });

  it('mantem cartao antigo que ainda tem lancamento posterior ao corte', async () => {
    await insertOwnedCard(pool, SHOWCASE_ID, { n: 1, createdAt: before });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, cardN: 1, paymentMethod: 'CARD', createdAt: after, closingDate: '2026-11-10', dueDate: '2026-11-20', referenceMonth: '2026-11-01' });
    expect(await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF)).toEqual({ entries: 0, cards: 0 });
    expect(await count('cards', SHOWCASE_ID)).toBe(1);
  });

  it('mantem cartao criado depois do corte', async () => {
    await insertOwnedCard(pool, SHOWCASE_ID, { n: 1, createdAt: after });
    expect((await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF)).cards).toBe(0);
    expect(await count('cards', SHOWCASE_ID)).toBe(1);
  });

  it('nao toca outro dono: nem Ana nem o dataset demo publico', async () => {
    await insertOwnedEntry(pool, ANA_ID, { n: 1, createdAt: before });
    await insertOwnedCard(pool, ANA_ID, { n: 1, createdAt: before });
    await insertOwnedEntry(pool, DEMO_USER_ID, { n: 2, createdAt: before });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 3, createdAt: before });
    await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF);
    expect(await count('entries', ANA_ID)).toBe(1);
    expect(await count('cards', ANA_ID)).toBe(1);
    expect(await count('entries', DEMO_USER_ID)).toBe(1);
    expect(await count('entries', SHOWCASE_ID)).toBe(0);
  });

  it('nao altera a conta (status, senha) nem as sessoes dela', async () => {
    await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF);
    const [row] = await query<{ status: string; password_hash: string }>(pool, 'SELECT status, password_hash FROM users WHERE id = $1::uuid', [SHOWCASE_ID]);
    expect(row).toEqual({ status: 'ACTIVE', password_hash: '$x' });
  });

  it('idempotente: segunda execucao devolve zeros', async () => {
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, createdAt: before });
    await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF);
    expect(await purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF)).toEqual({ entries: 0, cards: 0 });
  });

  it('tudo ou nada: se o DELETE de cartoes falha, o DELETE de lancamentos e desfeito', async () => {
    await insertOwnedCard(pool, SHOWCASE_ID, { n: 1, createdAt: before });
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, createdAt: before });
    await pool.query(`CREATE OR REPLACE FUNCTION fail_card_delete() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha induzida'; END $$ LANGUAGE plpgsql`);
    await pool.query('CREATE TRIGGER fail_card_delete BEFORE DELETE ON cards FOR EACH ROW EXECUTE FUNCTION fail_card_delete()');
    try {
      await expect(purger.purgeCreatedBefore(owner(SHOWCASE_ID), CUTOFF)).rejects.toThrow();
      expect(await count('entries', SHOWCASE_ID)).toBe(1);
      expect(await count('cards', SHOWCASE_ID)).toBe(1);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS fail_card_delete ON cards');
      await pool.query('DROP FUNCTION IF EXISTS fail_card_delete()');
    }
  });
});
