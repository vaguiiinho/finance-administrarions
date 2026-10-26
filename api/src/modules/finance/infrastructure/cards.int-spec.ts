import type pg from 'pg';
import { buildInfra, type Infra } from '@test/support/infra.js';
import { createPool, resetDb, insertCard, cardUuid, expectCheckViolation, query } from '@test/support/db.js';
import { NOW, cardId, newCard, rejected } from '@test/support/builders.js';

let pool: pg.Pool;
let infra: Infra;
beforeAll(async () => {
  pool = createPool();
  infra = await buildInfra();
});
afterAll(async () => {
  await infra.close();
  await pool.end();
});
beforeEach(() => resetDb(pool));

describe('PrismaCardRepository', () => {
  it('insert + findById fazem round trip de todos os campos', async () => {
    const card = newCard(1, { name: 'Nubank', closingDay: 25, dueDay: 5 });
    await infra.cards.insert(card);
    const found = await infra.cards.findById(cardId(1));
    expect(found).not.toBeNull();
    expect(found!.toSnapshot()).toEqual(card.toSnapshot());
  });

  it('grava name_key com a chave case-insensitive e timestamps em UTC', async () => {
    await infra.cards.insert(newCard(1, { name: 'Nubank' }));
    const [row] = await query<{ name_key: string; created_at: Date }>(pool, 'SELECT name_key, created_at FROM cards');
    expect(row.name_key).toBe('nubank');
    expect(row.created_at.toISOString()).toBe(NOW.toISOString());
  });

  it('findById inexistente -> null; findByNameKey encontra pela chave', async () => {
    await infra.cards.insert(newCard(1, { name: 'Nubank' }));
    expect(await infra.cards.findById(cardId(9))).toBeNull();
    expect((await infra.cards.findByNameKey('nubank'))?.id.value).toBe(cardUuid(1));
    expect(await infra.cards.findByNameKey('itau')).toBeNull();
  });

  it('update persiste nome, dias e updatedAt', async () => {
    const card = newCard(1, { name: 'Nubank', closingDay: 10, dueDay: 17 });
    await infra.cards.insert(card);
    const later = new Date('2026-10-06T09:30:00.000Z');
    card.update({ name: 'Nubank Plus', closingDay: 20, dueDay: 25 }, later);
    await infra.cards.update(card);
    const found = (await infra.cards.findById(cardId(1)))!.toSnapshot();
    expect(found.name.value).toBe('Nubank Plus');
    expect(found.closingDay.value).toBe(20);
    expect(found.dueDay.value).toBe(25);
    expect(found.updatedAt).toEqual(later);
    expect(found.createdAt).toEqual(NOW);
  });

  it('CA03: indice unico de name_key -> CardNameTakenError (insert)', async () => {
    await infra.cards.insert(newCard(1, { name: 'Nubank' }));
    const error = await rejected(infra.cards.insert(newCard(2, { name: ' NUBANK ' })));
    expect(error).toMatchObject({ code: 'CARD_NAME_TAKEN', kind: 'conflict' });
    expect(await query(pool, 'SELECT 1 FROM cards')).toHaveLength(1);
  });

  it('CA03: indice unico tambem protege o update', async () => {
    await infra.cards.insert(newCard(1, { name: 'Nubank' }));
    const itau = newCard(2, { name: 'Itau' });
    await infra.cards.insert(itau);
    itau.update({ name: 'nubank', closingDay: 25, dueDay: 5 }, new Date('2026-10-06T00:00:00.000Z'));
    expect(await rejected(infra.cards.update(itau))).toMatchObject({ code: 'CARD_NAME_TAKEN' });
  });

  it('CA03 (corrida): dois CreateCard simultaneos com o mesmo nome -> um sucesso e um CARD_NAME_TAKEN', async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb(pool);
      const results = await Promise.allSettled([
        infra.useCases.createCard.execute({ name: 'Nubank', closingDay: 25, dueDay: 5 }),
        infra.useCases.createCard.execute({ name: ' nubank ', closingDay: 1, dueDay: 2 }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].reason).toMatchObject({ code: 'CARD_NAME_TAKEN', kind: 'conflict' });
      expect(await query(pool, 'SELECT 1 FROM cards')).toHaveLength(1);
    }
  });
});

describe('PrismaCardReadModel', () => {
  it('CA04: listAll ordena por nome com acentos (ICU) e traz dias de fechamento/vencimento', async () => {
    await insertCard(pool, { n: 1, name: 'Nubank', closingDay: 25, dueDay: 5 });
    await insertCard(pool, { n: 2, name: 'Itaú', closingDay: 3, dueDay: 10 });
    await insertCard(pool, { n: 3, name: 'Ágil', closingDay: 1, dueDay: 2 });
    await insertCard(pool, { n: 4, name: 'Zeta', closingDay: 1, dueDay: 2 });
    const list = await infra.readModels.cards.listAll();
    expect(list.map((c) => c.name)).toEqual(['Ágil', 'Itaú', 'Nubank', 'Zeta']);
    expect(list.find((c) => c.name === 'Itaú')).toMatchObject({ id: cardUuid(2), closingDay: 3, dueDay: 10 });
  });

  it('findById retorna a view ou null', async () => {
    await insertCard(pool, { n: 1, name: 'Nubank' });
    expect(await infra.readModels.cards.findById(cardId(1))).toMatchObject({ id: cardUuid(1), name: 'Nubank' });
    expect(await infra.readModels.cards.findById(cardId(2))).toBeNull();
  });

  it('listAll vazio', async () => {
    expect(await infra.readModels.cards.listAll()).toEqual([]);
  });
});

describe('CHECKs de cards', () => {
  const bad = (over: Record<string, number | string>) =>
    pool.query(
      `INSERT INTO cards (id, name, name_key, closing_day, due_day, created_at, updated_at)
       VALUES ($1::uuid, 'X', $2, $3, $4, $5::timestamptz, $6::timestamptz)`,
      [cardUuid(1), 'x', over.closing ?? 10, over.due ?? 10, over.created ?? '2026-10-01T00:00:00Z', over.updated ?? '2026-10-01T00:00:00Z'],
    );

  it('controle: linha valida entra', async () => {
    await expect(bad({})).resolves.toBeDefined();
  });
  it.each([[0], [32]])('closing_day %i e rejeitado', async (closing) => {
    await expectCheckViolation(bad({ closing }));
  });
  it.each([[0], [32]])('due_day %i e rejeitado', async (due) => {
    await expectCheckViolation(bad({ due }));
  });
  it('updated_at < created_at e rejeitado', async () => {
    await expectCheckViolation(bad({ created: '2026-10-02T00:00:00Z', updated: '2026-10-01T00:00:00Z' }));
  });
});
