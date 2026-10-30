import type pg from 'pg';
import { buildInfra } from '@test/support/infra.js';
import { createPool, insertEntry, resetDb } from '@test/support/default-owner-db.js';
import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import { DEFAULT_OWNER, cardId, newCard, pixExpense, cardExpense, rejected } from '@test/support/builders.js';
import { CardNameTakenError } from '@finance/domain/card/errors/card-errors.js';

let pool: pg.Pool;
beforeAll(() => {
  pool = createPool();
});
afterAll(() => pool.end());
beforeEach(() => resetDb(pool));

describe('sessao do Prisma independe do DateStyle/fuso do banco', () => {
  it('banco com DateStyle "SQL, DMY" e TimeZone distinto: datas e instantes continuam corretos', async () => {
    await pool.query(`ALTER DATABASE finance_test SET datestyle = 'SQL, DMY'`);
    await pool.query(`ALTER DATABASE finance_test SET timezone = 'Asia/Tokyo'`);
    const infra = await buildInfra();
    try {
      await insertEntry(pool, { n: 1, date: '2026-03-04' });
      const view = await infra.readModels.entries.findById(DEFAULT_OWNER, { value: '00000000-0000-7000-8000-000000000000' } as never);
      expect(view).toBeNull();
      const entry = pixExpense(5, { date: '2026-03-04' });
      await infra.entries.insert(entry);
      const [found] = await infra.uow.run((s) => s.entries.findByIdsForUpdate(DEFAULT_OWNER, [entry.id]));
      expect(found.toSnapshot()).toEqual(entry.toSnapshot());
      const card = newCard(1);
      await infra.cards.insert(card);
      const ce = cardExpense(6, card, { date: '2026-10-11' });
      await infra.entries.insert(ce);
      const [loaded] = await infra.uow.run((s) => s.entries.findByIdsForUpdate(DEFAULT_OWNER, [ce.id]));
      expect(loaded.toSnapshot()).toEqual(ce.toSnapshot());
    } finally {
      await infra.close();
      await pool.query(`ALTER DATABASE finance_test RESET datestyle`);
      await pool.query(`ALTER DATABASE finance_test RESET timezone`);
    }
  });
});

describe('PrismaCardRepository - traducao de P2002 restrita ao indice de name_key', () => {
  it('P2002 de outro alvo nao vira CardNameTakenError', async () => {
    const infra = await buildInfra();
    try {
      const card = newCard(1, { name: 'A' });
      await infra.cards.insert(card);
      // mesmo id, outro nome: viola a PK (P2002 em id), nao o indice de nome
      const clash = newCard(1, { name: 'B' });
      const error = await rejected(infra.cards.insert(clash));
      expect(error).not.toBeInstanceOf(CardNameTakenError);
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      void cardId;
    } finally {
      await infra.close();
    }
  });
});
