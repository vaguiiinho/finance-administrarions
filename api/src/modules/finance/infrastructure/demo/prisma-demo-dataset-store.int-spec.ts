import type pg from 'pg';
import { buildInfra, type Infra } from '@test/support/infra.js';
import { createPool, query } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertUser, resetAll } from '@test/support/owned-db.js';
import { ANA, owner, ownedCard, ownedCardExpense, ownedEntry } from '@test/support/owned-builders.js';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { PrismaDemoDatasetStore } from './prisma-demo-dataset-store.js';
import { Card } from '@finance/domain/card/card.js';
import { Entry } from '@finance/domain/entry/entry.js';

let pool: pg.Pool;
let infra: Infra;
let store: PrismaDemoDatasetStore;
const demo = owner(DEMO_USER_ID);
beforeAll(async () => {
  pool = createPool();
  infra = await buildInfra();
  store = new PrismaDemoDatasetStore(infra.prisma);
});
afterAll(async () => {
  await infra.close();
  await pool.end();
});
beforeEach(async () => {
  await resetAll(pool);
  await insertUser(pool, { n: 90, id: DEMO_USER_ID, kind: 'DEMO', passwordHash: null, name: 'Demonstração', email: 'demo@finance.invalid' });
  await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
});

const ym = (v: string) => {
  const [y, m] = v.split('-').map(Number);
  return YearMonth.of(y, m);
};
/** Dataset minimo valido: `cardsN` cartoes e uma despesa PIX + uma no cartao por cartao. Ids deslocados por `base`. */
const buildFn = (base = 100, cardsN = 2) => () => {
  const cards: Card[] = [];
  const entries: Entry[] = [];
  for (let i = 0; i < cardsN; i++) {
    const card = ownedCard(demo, base + i, { name: `Demo ${base + i}` });
    cards.push(card);
    entries.push(ownedCardExpense(demo, base + i, card));
    entries.push(ownedEntry(demo, base + 50 + i));
  }
  return { cards, entries };
};
const count = async (table: string, userId = DEMO_USER_ID) =>
  Number((await query<{ n: string }>(pool, `SELECT count(*) AS n FROM ${table} WHERE user_id = $1`, [userId]))[0].n);

describe('PrismaDemoDatasetStore.replaceIfStale (CA34, ADR 5.6)', () => {
  it('primeira vez: grava o dataset e o registro (ancora, versao) e devolve true', async () => {
    expect(await store.replaceIfStale(demo, ym('2026-10'), 1, buildFn())).toBe(true);
    expect(await count('cards')).toBe(2);
    expect(await count('entries')).toBe(4);
    const [row] = await query<{ owner_id: string; anchor_month: Date; template_version: number }>(pool, 'SELECT owner_id, anchor_month, template_version FROM demo_datasets');
    expect(row.owner_id).toBe(DEMO_USER_ID);
    expect(row.template_version).toBe(1);
    expect(new Date(row.anchor_month).toISOString().slice(0, 7)).toBe('2026-10');
  });

  it('idempotente: mesma ancora e versao -> false, NAO chama build e nao duplica nada', async () => {
    await store.replaceIfStale(demo, ym('2026-10'), 1, buildFn());
    const build = vi.fn(buildFn());
    expect(await store.replaceIfStale(demo, ym('2026-10'), 1, build)).toBe(false);
    expect(build).not.toHaveBeenCalled();
    expect(await count('cards')).toBe(2);
    expect(await count('entries')).toBe(4);
    expect(await query(pool, 'SELECT 1 FROM demo_datasets')).toHaveLength(1);
  });

  it('mes novo (ancora diferente): substitui o dataset inteiro e atualiza o registro', async () => {
    await store.replaceIfStale(demo, ym('2026-10'), 1, buildFn(100, 2));
    expect(await store.replaceIfStale(demo, ym('2026-11'), 1, buildFn(200, 3))).toBe(true);
    expect(await count('cards')).toBe(3);
    expect(await count('entries')).toBe(6);
    const [row] = await query<{ anchor_month: Date }>(pool, 'SELECT anchor_month FROM demo_datasets');
    expect(new Date(row.anchor_month).toISOString().slice(0, 7)).toBe('2026-11');
  });

  it('versao nova do template tambem regenera (Feature B)', async () => {
    await store.replaceIfStale(demo, ym('2026-10'), 1, buildFn());
    expect(await store.replaceIfStale(demo, ym('2026-10'), 2, buildFn(300, 1))).toBe(true);
    expect(await count('cards')).toBe(1);
  });

  it('nunca toca nos dados de outros usuarios', async () => {
    await insertOwnedCard(pool, ANA, { n: 1, name: 'Nubank' });
    await insertOwnedEntry(pool, ANA, { n: 1 });
    await store.replaceIfStale(demo, ym('2026-10'), 1, buildFn());
    await store.replaceIfStale(demo, ym('2026-11'), 1, buildFn(200, 1));
    expect(await count('cards', ANA)).toBe(1);
    expect(await count('entries', ANA)).toBe(1);
  });

  it('concorrencia: duas chamadas simultaneas com os mesmos argumentos -> exatamente uma true e sem duplicar (10x)', async () => {
    for (let i = 0; i < 10; i++) {
      await query(pool, 'TRUNCATE entries, cards, demo_datasets CASCADE');
      const results = await Promise.all([
        store.replaceIfStale(demo, ym('2026-10'), 1, buildFn()),
        store.replaceIfStale(demo, ym('2026-10'), 1, buildFn()),
      ]);
      expect(results.filter(Boolean), `iteracao ${i}`).toHaveLength(1);
      expect(await count('cards')).toBe(2);
      expect(await count('entries')).toBe(4);
    }
  });

  it('falha no build: nada e gravado (transacao) e o registro nao muda', async () => {
    await store.replaceIfStale(demo, ym('2026-10'), 1, buildFn());
    await expect(
      store.replaceIfStale(demo, ym('2026-11'), 1, () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await count('cards')).toBe(2);
    const [row] = await query<{ anchor_month: Date }>(pool, 'SELECT anchor_month FROM demo_datasets');
    expect(new Date(row.anchor_month).toISOString().slice(0, 7)).toBe('2026-10');
  });
});
