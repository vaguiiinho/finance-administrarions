import { inject } from 'vitest';
import type pg from 'pg';
import { createPool, query } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertSession, insertUser, resetAll } from '@test/support/owned-db.js';
import { ANA, owner, ownedCard, ownedCardExpense, ownedEntry } from '@test/support/owned-builders.js';
import { rejected } from '@test/support/builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID } from '@test/support/showcase-builders.js';
import { FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service.js';
import type { Card } from '@finance/domain/card/card.js';
import type { Entry } from '@finance/domain/entry/entry.js';
import type { OwnerDataResetRequest } from '@finance/application/ports/owner-data-reset-store.js';
import { PrismaOwnerDataResetStore } from './prisma-owner-data-reset-store.js';

/**
 * PrismaOwnerDataResetStore (ADR 0013 5.1, 8): apaga e restaura os dados de UM dono numa transacao so, sob advisory lock
 * por dono, com a condicao avaliada sob o lock. CONTRATO: `new PrismaOwnerDataResetStore(prisma)` em
 * `finance/infrastructure/maintenance/`; `reset(ownerId: OwnerId, request)`; tabela `owner_data_resets` (migration M2).
 */
let pool: pg.Pool;
let prisma: PrismaService;
let store: PrismaOwnerDataResetStore;
const showcase = owner(SHOWCASE_ID);
const T1 = new Date('2026-11-15T06:00:00.000Z'); // 03:00 de SP
const T0 = new Date('2026-11-14T06:00:00.000Z'); // 03:00 do dia anterior
const ym = (v: string) => {
  const [y, m] = v.split('-').map(Number);
  return YearMonth.of(y, m);
};

beforeAll(async () => {
  pool = createPool();
  process.env.DATABASE_URL = inject('databaseUrl');
  prisma = new PrismaService();
  await prisma.$connect();
  store = new PrismaOwnerDataResetStore(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});
beforeEach(async () => {
  await resetAll(pool);
  await insertUser(pool, { n: 50, id: SHOWCASE_ID, kind: 'SHOWCASE', email: SHOWCASE_EMAIL, name: 'Conta de demonstração', passwordHash: '$x' });
  await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
  await insertUser(pool, { n: 4, id: FIRST_ADMIN_ID, name: 'Admin', email: 'admin@exemplo.com', role: 'ADMIN' });
});

/** Dataset valido: `cardsN` cartoes; por cartao, uma despesa no cartao e uma despesa PIX. Ids deslocados por `base`. */
const buildFn =
  (base = 1000, cardsN = 2, tag = 'Exemplo') =>
  (): { cards: Card[]; entries: Entry[] } => {
    const cards: Card[] = [];
    const entries: Entry[] = [];
    for (let i = 0; i < cardsN; i++) {
      const card = ownedCard(showcase, base + i, { name: `${tag} ${base + i}` });
      cards.push(card);
      entries.push(ownedCardExpense(showcase, base + i, card, { description: `${tag} cartao ${i}` }));
      entries.push(ownedEntry(showcase, base + 50 + i, { description: `${tag} pix ${i}` }));
    }
    return { cards, entries };
  };
const request = (over: Partial<OwnerDataResetRequest> = {}, anchor = '2026-11', version = 1, build = buildFn()): OwnerDataResetRequest => ({
  sample: { anchor: ym(anchor), version, build },
  condition: { kind: 'always' },
  at: T1,
  ...over,
});
const count = async (table: 'entries' | 'cards' | 'sessions', userId: string) =>
  Number((await query<{ c: string }>(pool, `SELECT count(*) AS c FROM ${table} WHERE user_id = $1::uuid`, [userId]))[0].c);
const control = async (ownerId = SHOWCASE_ID) =>
  (await query<{ anchor_month: Date | null; template_version: number | null; last_reset_at: Date }>(
    pool,
    'SELECT anchor_month, template_version, last_reset_at FROM owner_data_resets WHERE owner_id = $1::uuid',
    [ownerId],
  ))[0];
const descriptions = async (userId = SHOWCASE_ID) =>
  (await query<{ description: string }>(pool, 'SELECT description FROM entries WHERE user_id = $1::uuid ORDER BY description', [userId])).map((r) => r.description);

async function seedVisitorData(): Promise<void> {
  await insertOwnedEntry(pool, SHOWCASE_ID, { n: 1, description: 'Teste visitante', category: 'Visitante' });
  await insertOwnedCard(pool, SHOWCASE_ID, { n: 1, name: 'Cartao X' });
  await insertOwnedEntry(pool, SHOWCASE_ID, { n: 2, cardN: 1, paymentMethod: 'CARD', status: 'PENDING', paidAt: null, closingDate: '2026-11-10', dueDate: '2026-11-20', referenceMonth: '2026-11-01', description: 'Compra no Cartao X' });
}
async function seedOthers(): Promise<void> {
  await insertOwnedCard(pool, ANA, { n: 201, name: 'Nubank' });
  for (let i = 0; i < 10; i++) await insertOwnedEntry(pool, ANA, { n: 210 + i, description: `Ana ${i}` });
  for (let i = 0; i < 4; i++) await insertOwnedEntry(pool, FIRST_ADMIN_ID, { n: 230 + i, description: `Admin ${i}` });
}

describe('PrismaOwnerDataResetStore.reset: always com dataset (CA18, CA19)', () => {
  it('CA18: apaga lancamentos e cartoes de visitantes (inclusive cartao novo com lancamentos) e grava exatamente o dataset', async () => {
    await seedVisitorData();
    const outcome = await store.reset(showcase, request());
    expect(outcome).toEqual({ status: 'reset', deleted: { entries: 2, cards: 1 }, restored: { entries: 4, cards: 2 } });
    expect(await count('cards', SHOWCASE_ID)).toBe(2);
    expect(await descriptions()).toEqual(['Exemplo cartao 0', 'Exemplo cartao 1', 'Exemplo pix 0', 'Exemplo pix 1']);
    const names = (await query<{ name: string }>(pool, 'SELECT name FROM cards WHERE user_id = $1::uuid ORDER BY name', [SHOWCASE_ID])).map((r) => r.name);
    expect(names).not.toContain('Cartao X');
  });

  it('as categorias que so existiam por lancamento do visitante somem (derivadas dos lancamentos)', async () => {
    await seedVisitorData();
    await store.reset(showcase, request());
    const cats = (await query<{ category: string }>(pool, 'SELECT DISTINCT category FROM entries WHERE user_id = $1::uuid', [SHOWCASE_ID])).map((r) => r.category);
    expect(cats).not.toContain('Visitante');
  });

  it('grava o controle: ancora (mes), versao e last_reset_at = `at` recebido (nunca o relogio do adapter)', async () => {
    await store.reset(showcase, request());
    const row = await control();
    expect(new Date(row.anchor_month!).toISOString().slice(0, 7)).toBe('2026-11');
    expect(row.template_version).toBe(1);
    expect(new Date(row.last_reset_at)).toEqual(T1);
  });

  it('CA19: as alteracoes de visitantes em dados de exemplo (excluir, pagar, editar) sao desfeitas', async () => {
    await store.reset(showcase, request());
    const original = await query(pool, 'SELECT id, description, amount::text, status, paid_at FROM entries WHERE user_id = $1::uuid ORDER BY id', [SHOWCASE_ID]);
    await pool.query(`DELETE FROM entries WHERE user_id = $1::uuid AND description = 'Exemplo pix 0'`, [SHOWCASE_ID]);
    await pool.query(`UPDATE entries SET status = 'PAID', paid_at = now() WHERE user_id = $1::uuid AND description = 'Exemplo cartao 0'`, [SHOWCASE_ID]);
    await pool.query(`UPDATE entries SET amount = 999.99 WHERE user_id = $1::uuid AND description = 'Exemplo pix 1'`, [SHOWCASE_ID]);
    await store.reset(showcase, request({ at: new Date(T1.getTime() + 1000) }));
    expect(await query(pool, 'SELECT id, description, amount::text, status, paid_at FROM entries WHERE user_id = $1::uuid ORDER BY id', [SHOWCASE_ID])).toEqual(original);
  });

  it('CA22: rodar duas vezes seguidas deixa a conta no mesmo estado, sem erro (nem de chave duplicada)', async () => {
    await store.reset(showcase, request());
    const again = await store.reset(showcase, request({ at: new Date(T1.getTime() + 1000) }));
    expect(again).toMatchObject({ status: 'reset', deleted: { entries: 4, cards: 2 }, restored: { entries: 4, cards: 2 } });
    expect(await count('cards', SHOWCASE_ID)).toBe(2);
    expect(await count('entries', SHOWCASE_ID)).toBe(4);
    expect(await query(pool, 'SELECT 1 FROM owner_data_resets')).toHaveLength(1);
  });

  it('conta vazia: restaura sem apagar nada (deleted zerado)', async () => {
    expect(await store.reset(showcase, request())).toEqual({ status: 'reset', deleted: { entries: 0, cards: 0 }, restored: { entries: 4, cards: 2 } });
  });
});

describe('PrismaOwnerDataResetStore.reset: sem dataset (P13, CA28)', () => {
  it('sample = null apaga tudo, nao restaura nada e registra controle sem ancora nem versao', async () => {
    await seedVisitorData();
    const outcome = await store.reset(showcase, request({ sample: null }));
    expect(outcome).toEqual({ status: 'reset', deleted: { entries: 2, cards: 1 }, restored: { entries: 0, cards: 0 } });
    expect(await count('entries', SHOWCASE_ID)).toBe(0);
    expect(await count('cards', SHOWCASE_ID)).toBe(0);
    const row = await control();
    expect(row.anchor_month).toBeNull();
    expect(row.template_version).toBeNull();
    expect(new Date(row.last_reset_at)).toEqual(T1);
  });

  it('nao altera a conta: ainda ativa, mesmo hash e mesmo nome', async () => {
    await store.reset(showcase, request({ sample: null }));
    const [row] = await query<{ status: string; password_hash: string; name: string }>(pool, 'SELECT status, password_hash, name FROM users WHERE id = $1::uuid', [SHOWCASE_ID]);
    expect(row).toEqual({ status: 'ACTIVE', password_hash: '$x', name: 'Conta de demonstração' });
  });
});

describe('PrismaOwnerDataResetStore.reset: condition not-reset-since (RF16, R7, CA27)', () => {
  it('sem registro anterior -> roda', async () => {
    await seedVisitorData();
    const outcome = await store.reset(showcase, request({ condition: { kind: 'not-reset-since', since: T1 } }));
    expect(outcome.status).toBe('reset');
  });

  it('last_reset_at < since -> roda e atualiza last_reset_at', async () => {
    await store.reset(showcase, request({ at: T0 }));
    const outcome = await store.reset(showcase, request({ condition: { kind: 'not-reset-since', since: T1 }, at: T1 }));
    expect(outcome.status).toBe('reset');
    expect(new Date((await control()).last_reset_at)).toEqual(T1);
  });

  it('last_reset_at >= since -> skipped, sem tocar em dados nem no registro (a subida do deploy nao zera a conta, R7)', async () => {
    await store.reset(showcase, request({ at: T1 }));
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 3, description: 'Criado depois do 03:00 por quem esta testando' });
    const build = vi.fn(buildFn());
    const outcome = await store.reset(showcase, request({ condition: { kind: 'not-reset-since', since: T1 }, at: new Date(T1.getTime() + 3_600_000) }, '2026-11', 1, build));
    expect(outcome).toEqual({ status: 'skipped' });
    expect(build).not.toHaveBeenCalled();
    expect(await descriptions()).toContain('Criado depois do 03:00 por quem esta testando');
    expect(new Date((await control()).last_reset_at)).toEqual(T1);
  });

  it('last_reset_at > since (executou depois do corte) -> skipped', async () => {
    await store.reset(showcase, request({ at: new Date(T1.getTime() + 60_000) }));
    expect((await store.reset(showcase, request({ condition: { kind: 'not-reset-since', since: T1 } }))).status).toBe('skipped');
  });
});

describe('PrismaOwnerDataResetStore.reset: condition sample-stale (seed, CA17)', () => {
  it('sem registro -> roda e grava o dataset', async () => {
    expect(await store.reset(showcase, request({ condition: { kind: 'sample-stale' } }))).toMatchObject({ status: 'reset', restored: { entries: 4, cards: 2 } });
  });

  it('mesma ancora e versao -> skipped, build NAO e chamado e nada muda (o seed nao zera a conta a cada subida)', async () => {
    await store.reset(showcase, request());
    await insertOwnedEntry(pool, SHOWCASE_ID, { n: 3, description: 'Do visitante' });
    const build = vi.fn(buildFn());
    expect(await store.reset(showcase, request({ condition: { kind: 'sample-stale' } }, '2026-11', 1, build))).toEqual({ status: 'skipped' });
    expect(build).not.toHaveBeenCalled();
    expect(await descriptions()).toContain('Do visitante');
  });

  it('ancora diferente (virada de mes) -> roda', async () => {
    await store.reset(showcase, request());
    const outcome = await store.reset(showcase, request({ condition: { kind: 'sample-stale' } }, '2026-12', 1, buildFn(2000, 2)));
    expect(outcome.status).toBe('reset');
    expect(new Date((await control()).anchor_month!).toISOString().slice(0, 7)).toBe('2026-12');
  });

  it('versao diferente do dataset -> roda', async () => {
    await store.reset(showcase, request());
    expect((await store.reset(showcase, request({ condition: { kind: 'sample-stale' } }, '2026-11', 2, buildFn(3000, 1)))).status).toBe('reset');
    expect((await control()).template_version).toBe(2);
  });

  it('registro anterior sem dataset (conta ficou inativa e foi reativada) -> roda', async () => {
    await store.reset(showcase, request({ sample: null }));
    expect((await store.reset(showcase, request({ condition: { kind: 'sample-stale' } }))).status).toBe('reset');
    expect(await count('cards', SHOWCASE_ID)).toBe(2);
  });

  it('sample-stale sem dataset (sample = null) e erro de programacao: InvariantViolationError e nada e apagado', async () => {
    await seedVisitorData();
    const error = await rejected(store.reset(showcase, request({ sample: null, condition: { kind: 'sample-stale' } })));
    expect(error.name).toBe('InvariantViolationError');
    expect(await count('entries', SHOWCASE_ID)).toBe(2);
  });
});

describe('PrismaOwnerDataResetStore.reset: tudo ou nada (CA21)', () => {
  const failInserts = async () => {
    await pool.query(`CREATE OR REPLACE FUNCTION fail_entry_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha induzida'; END $$ LANGUAGE plpgsql`);
    await pool.query('CREATE TRIGGER fail_entry_insert BEFORE INSERT ON entries FOR EACH ROW EXECUTE FUNCTION fail_entry_insert()');
  };
  const dropFailInserts = async () => {
    await pool.query('DROP TRIGGER IF EXISTS fail_entry_insert ON entries');
    await pool.query('DROP FUNCTION IF EXISTS fail_entry_insert()');
  };

  it('falha ao inserir o dataset (depois dos DELETE): nada apagado, nada parcial, last_reset_at e ancora intactos', async () => {
    await store.reset(showcase, request({ at: T0 }));
    await seedVisitorData();
    const before = { entries: await descriptions(), cards: await count('cards', SHOWCASE_ID), control: await control() };
    await failInserts();
    try {
      await expect(store.reset(showcase, request({ at: T1 }, '2026-12', 1, buildFn(2000, 2, 'Novo')))).rejects.toThrow();
    } finally {
      await dropFailInserts();
    }
    expect(await descriptions()).toEqual(before.entries);
    expect(await count('cards', SHOWCASE_ID)).toBe(before.cards);
    expect(await control()).toEqual(before.control);
  });

  it('falha no build: nada e apagado e o controle nao muda', async () => {
    await seedVisitorData();
    await expect(
      store.reset(showcase, request({}, '2026-11', 1, () => {
        throw new Error('boom');
      })),
    ).rejects.toThrow('boom');
    expect(await count('entries', SHOWCASE_ID)).toBe(2);
    expect(await count('cards', SHOWCASE_ID)).toBe(1);
    expect(await query(pool, 'SELECT 1 FROM owner_data_resets')).toHaveLength(0);
  });

  it('a proxima execucao depois da falha tenta de novo e conclui', async () => {
    await seedVisitorData();
    await failInserts();
    await store.reset(showcase, request()).catch(() => undefined);
    await dropFailInserts();
    expect((await store.reset(showcase, request({ condition: { kind: 'not-reset-since', since: T1 } }))).status).toBe('reset');
    expect(await count('cards', SHOWCASE_ID)).toBe(2);
  });
});

describe('PrismaOwnerDataResetStore.reset: isolamento e sessoes (CA23, CA24)', () => {
  it('CA23: so os dados do dono mudam; Ana e o administrador seguem identicos', async () => {
    await seedOthers();
    await seedVisitorData();
    const anaBefore = await descriptions(ANA);
    const adminBefore = await descriptions(FIRST_ADMIN_ID);
    await store.reset(showcase, request());
    expect(await descriptions(ANA)).toEqual(anaBefore);
    expect(await descriptions(FIRST_ADMIN_ID)).toEqual(adminBefore);
    expect(await count('cards', ANA)).toBe(1);
    expect(await query(pool, 'SELECT 1 FROM owner_data_resets WHERE owner_id <> $1::uuid', [SHOWCASE_ID])).toHaveLength(0);
  });

  it('um reset de Ana nao toca nos dados da conta demo (o dono vem do parametro, sem conhecer a conta demo)', async () => {
    await seedVisitorData();
    await insertOwnedEntry(pool, ANA, { n: 300, description: 'Da Ana' });
    await store.reset(owner(ANA), { sample: null, condition: { kind: 'always' }, at: T1 });
    expect(await count('entries', ANA)).toBe(0);
    expect(await count('entries', SHOWCASE_ID)).toBe(2);
  });

  it('CA24: as sessoes da conta demo ficam intactas (mesmo numero, mesmos ids)', async () => {
    await seedVisitorData();
    await insertSession(pool, { n: 1, userId: SHOWCASE_ID, createdAt: '2026-11-14T10:00:00.000Z', expiresAt: '2026-11-16T10:00:00.000Z' });
    await insertSession(pool, { n: 2, userId: SHOWCASE_ID, createdAt: '2026-11-14T11:00:00.000Z', expiresAt: '2026-11-16T11:00:00.000Z' });
    const before = await query(pool, 'SELECT id, token_digest, expires_at FROM sessions WHERE user_id = $1::uuid ORDER BY id', [SHOWCASE_ID]);
    await store.reset(showcase, request());
    await store.reset(showcase, request({ sample: null }));
    expect(await query(pool, 'SELECT id, token_digest, expires_at FROM sessions WHERE user_id = $1::uuid ORDER BY id', [SHOWCASE_ID])).toEqual(before);
    expect(before).toHaveLength(2);
  });
});

describe('PrismaOwnerDataResetStore.reset: concorrencia e lock (RF18, CA26)', () => {
  it('CA26: duas execucoes `always` simultaneas (agendada + manual) -> exatamente um dataset, sem erro de chave duplicada (10x)', async () => {
    for (let i = 0; i < 10; i++) {
      await query(pool, 'TRUNCATE entries, cards, owner_data_resets CASCADE');
      const results = await Promise.all([store.reset(showcase, request()), store.reset(showcase, request({ at: new Date(T1.getTime() + 1) }))]);
      expect(results.map((r) => r.status), `iteracao ${i}`).toEqual(['reset', 'reset']);
      expect(await count('cards', SHOWCASE_ID), `iteracao ${i}`).toBe(2);
      expect(await count('entries', SHOWCASE_ID), `iteracao ${i}`).toBe(4);
      expect(await query(pool, 'SELECT 1 FROM owner_data_resets')).toHaveLength(1);
    }
  });

  it('duas `not-reset-since` simultaneas com o mesmo `since` (duas replicas as 03:00) -> uma reset e uma skipped (10x)', async () => {
    for (let i = 0; i < 10; i++) {
      await query(pool, 'TRUNCATE entries, cards, owner_data_resets CASCADE');
      const cond = { kind: 'not-reset-since', since: T1 } as const;
      const results = await Promise.all([store.reset(showcase, request({ condition: cond })), store.reset(showcase, request({ condition: cond }))]);
      expect(results.map((r) => r.status).sort(), `iteracao ${i}`).toEqual(['reset', 'skipped']);
      expect(await count('cards', SHOWCASE_ID)).toBe(2);
    }
  });

  it('duas `sample-stale` simultaneas (seed em duas replicas) -> uma reset e uma skipped', async () => {
    await query(pool, 'TRUNCATE entries, cards, owner_data_resets CASCADE');
    const results = await Promise.all([store.reset(showcase, request({ condition: { kind: 'sample-stale' } })), store.reset(showcase, request({ condition: { kind: 'sample-stale' } }))]);
    expect(results.map((r) => r.status).sort()).toEqual(['reset', 'skipped']);
  });

  it('advisory lock por dono: enquanto outra transacao segura o lock do dono, a redefinicao espera; liberado, conclui', async () => {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtext('owner-data-reset:' || $1::text))`, [SHOWCASE_ID]);
      let done = false;
      const pending = store.reset(showcase, request()).then((r) => {
        done = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 600));
      expect(done).toBe(false);
      await holder.query('COMMIT');
      expect((await pending).status).toBe('reset');
    } finally {
      holder.release();
    }
  });

  it('o lock e por dono: segurar o lock da Ana nao bloqueia a conta demo', async () => {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtext('owner-data-reset:' || $1::text))`, [ANA]);
      const outcome = await Promise.race([store.reset(showcase, request()), new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 5_000))]);
      expect(outcome).not.toBe('timeout');
      await holder.query('COMMIT');
    } finally {
      holder.release();
    }
  });
});

describe('PrismaOwnerDataResetStore.reset: desempenho (RNF03, lento)', () => {
  it('10.000 lancamentos de visitantes + restauracao em menos de 10 s', async () => {
    await pool.query(
      `INSERT INTO entries (id, user_id, type, description, category, category_key, "date", amount, payment_method, reference_month, status, paid_at, created_at, updated_at)
       SELECT ('e1000000-0000-7000-8000-' || lpad(g::text, 12, '0'))::uuid, $1::uuid, 'EXPENSE'::entry_type, 'Visitante ' || g, 'Moradia', 'moradia',
              '2026-11-05'::date, 10, 'PIX'::payment_method, '2026-11-01'::date, 'PAID'::entry_status, '2026-11-05T13:00:00Z'::timestamptz,
              '2026-11-05T13:00:00Z'::timestamptz, '2026-11-05T13:00:00Z'::timestamptz
       FROM generate_series(1, 10000) g`,
      [SHOWCASE_ID],
    );
    const started = Date.now();
    const outcome = await store.reset(showcase, request());
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(outcome).toMatchObject({ status: 'reset', deleted: { entries: 10000, cards: 0 }, restored: { entries: 4, cards: 2 } });
  }, 60_000);
});
