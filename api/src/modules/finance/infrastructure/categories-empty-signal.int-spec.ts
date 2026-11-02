import type pg from 'pg';
import { buildInfra, type Infra } from '@test/support/infra.js';
import { createPool } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertUser, resetAll } from '@test/support/owned-db.js';
import { DEFAULT_OWNER, DEFAULT_OWNER_ID_VALUE } from '@test/support/builders.js';

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
beforeEach(async () => {
  await resetAll(pool);
  await insertUser(pool, { n: 1, id: DEFAULT_OWNER_ID_VALUE });
});

/** ADR 0011 10.13: o app usa `GET /api/categories` vazio como sinal de "conta sem dados". Estes testes fixam a propriedade. */
describe('CategoryReadModel.listDistinct: lista vazia SE E SOMENTE SE o dono nao tem lancamentos', () => {
  it('dono sem lancamentos -> []', async () => {
    expect(await infra.readModels.categories.listDistinct(DEFAULT_OWNER)).toEqual([]);
  });

  it('uma receita em qualquer mes -> nao vazio', async () => {
    await insertOwnedEntry(pool, DEFAULT_OWNER_ID_VALUE, { n: 1, type: 'INCOME', category: 'Salário', date: '2019-03-10' });
    expect(await infra.readModels.categories.listDistinct(DEFAULT_OWNER)).toEqual(['Salário']);
  });

  it('uma despesa pendente de outro mes -> nao vazio', async () => {
    await insertOwnedEntry(pool, DEFAULT_OWNER_ID_VALUE, { n: 1, status: 'PENDING', paidAt: null, category: 'Moradia', date: '2031-12-01' });
    expect(await infra.readModels.categories.listDistinct(DEFAULT_OWNER)).toEqual(['Moradia']);
  });

  it('cartao cadastrado sem lancamentos -> [] (cartoes nao entram no sinal)', async () => {
    await insertOwnedCard(pool, DEFAULT_OWNER_ID_VALUE, { n: 1 });
    expect(await infra.readModels.categories.listDistinct(DEFAULT_OWNER)).toEqual([]);
  });

  it('lancamentos de outro dono nao contam', async () => {
    await insertUser(pool, { n: 2 });
    await insertOwnedEntry(pool, '0a000000-0000-7000-8000-000000000002', { n: 1, category: 'Lazer' });
    expect(await infra.readModels.categories.listDistinct(DEFAULT_OWNER)).toEqual([]);
  });
});
