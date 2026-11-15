import type pg from 'pg';
import { buildInfra, type Infra } from '@test/support/infra.js';
import { createPool, cardUuid, entryUuid, cardEntry, query } from '@test/support/db.js';
import { insertOwnedCard, insertOwnedEntry, insertUser, resetAll } from '@test/support/owned-db.js';
import { rejected, cardId, entryId } from '@test/support/builders.js';
import { ANA, BRUNO, ana, bruno, ownedCard, ownedCardExpense, ownedEntry, ownedIncome, ownerOf } from '@test/support/owned-builders.js';
import { ReferenceMonth } from '@finance/domain/billing/reference-month.js';
import { InvoiceKey } from '@finance/domain/billing/invoice-key.js';
import { Card } from '@finance/domain/card/card.js';
import { unwrap } from '@test/support/result.js';

/**
 * RNF06 / CA29-CA33: cada repositorio, catalogo e read model com DOIS donos (Ana e Bruno) no Postgres real.
 * CONTRATO: `ownerId` como PRIMEIRO parametro (ADR 0005 4.2). Os casts `as never` existem porque as assinaturas atuais ainda nao o tem.
 */
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
  await insertUser(pool, { n: 1, name: 'Ana', email: 'ana@exemplo.com' });
  await insertUser(pool, { n: 2, name: 'Bruno', email: 'bruno@exemplo.com' });
});

const month = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));
const MONTH = month('2026-11');
const rm = infra_rm();
function infra_rm() {
  return {
    get entries() { return infra.readModels.entries as any; },
    get summary() { return infra.readModels.summary as any; },
    get invoices() { return infra.readModels.invoices as any; },
    get cards() { return infra.readModels.cards as any; },
    get categories() { return infra.readModels.categories as any; },
    get dashboard() { return infra.readModels.dashboard as any; },
  };
}
const A = ana as never;
const B = bruno as never;
const paging = { page: 1, pageSize: 20 };
const any = { kind: 'any' } as const;

/** Ana: salario 5000 + despesa PIX paga 600 + cartao Nubank (fatura 2026-11: 250 pendente). Bruno: 100 + 50 + cartao Itau 70. */
async function seedBoth() {
  await insertOwnedCard(pool, ANA, { n: 1, name: 'Nubank', closingDay: 25, dueDay: 5 });
  await insertOwnedCard(pool, BRUNO, { n: 2, name: 'Itau', closingDay: 25, dueDay: 5 });
  await insertOwnedEntry(pool, ANA, { n: 1, type: 'INCOME', amount: '5000.00', date: '2026-11-05', category: 'Salario' });
  await insertOwnedEntry(pool, ANA, { n: 2, amount: '600.00', date: '2026-11-07', category: 'Moradia' });
  await insertOwnedEntry(pool, ANA, cardEntry(3, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '250.00', category: 'Lazer' }));
  await insertOwnedEntry(pool, BRUNO, { n: 11, type: 'INCOME', amount: '100.00', date: '2026-11-05', category: 'Bonus' });
  await insertOwnedEntry(pool, BRUNO, { n: 12, amount: '50.00', date: '2026-11-07', category: 'Mercado' });
  await insertOwnedEntry(pool, BRUNO, cardEntry(13, 2, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '70.00', category: 'Viagem' }));
}

describe('CardRepository com dono', () => {
  it('insert grava o dono; findById so acha para o dono; findByNameKey e por dono', async () => {
    await infra.cards.insert(ownedCard(ana, 1, { name: 'Nubank' }));
    expect(ownerOf((await (infra.cards as any).findById(A, cardId(1))) as never)).toBe(ANA);
    expect(await (infra.cards as any).findById(B, cardId(1))).toBeNull();
    expect((await (infra.cards as any).findByNameKey(A, 'nubank'))?.id.value).toBe(cardUuid(1));
    expect(await (infra.cards as any).findByNameKey(B, 'nubank')).toBeNull();
    const [row] = await query<{ user_id: string }>(pool, 'SELECT user_id FROM cards');
    expect(row.user_id).toBe(ANA);
  });

  it('CA32: o mesmo nome em donos diferentes e permitido; no mesmo dono -> CardNameTakenError', async () => {
    await infra.cards.insert(ownedCard(bruno, 1, { name: 'Nubank' }));
    await expect(infra.cards.insert(ownedCard(ana, 2, { name: 'nubank' }))).resolves.toBeUndefined();
    const error = await rejected(infra.cards.insert(ownedCard(ana, 3, { name: 'NUBANK' })));
    expect(error).toMatchObject({ code: 'CARD_NAME_TAKEN' });
  });

  it('update com o dono errado nao altera o cartao do outro dono', async () => {
    await infra.cards.insert(ownedCard(ana, 1, { name: 'Nubank', closingDay: 10, dueDay: 17 }));
    const hijack = Card.restore({ ...ownedCard(bruno, 1, { name: 'Hack', closingDay: 1, dueDay: 2 }).toSnapshot() });
    await infra.cards.update(hijack).catch(() => undefined);
    const [row] = await query<{ name: string; user_id: string; closing_day: number }>(pool, 'SELECT name, user_id, closing_day FROM cards');
    expect(row).toMatchObject({ name: 'Nubank', user_id: ANA, closing_day: 10 });
  });

  it('read model de cartoes: cada um ve so os seus; findById cruzado -> null', async () => {
    await seedBoth();
    expect((await rm.cards.listAll(A)).map((c: { name: string }) => c.name)).toEqual(['Nubank']);
    expect((await rm.cards.listAll(B)).map((c: { name: string }) => c.name)).toEqual(['Itau']);
    expect(await rm.cards.findById(A, cardId(2))).toBeNull();
    expect((await rm.cards.findById(B, cardId(2)))?.name).toBe('Itau');
  });
});

describe('EntryRepository e UnitOfWork com dono', () => {
  it('insert grava o dono do lancamento', async () => {
    await infra.entries.insert(ownedEntry(ana, 1));
    const [row] = await query<{ user_id: string }>(pool, 'SELECT user_id FROM entries');
    expect(row.user_id).toBe(ANA);
  });

  it('findByIdsForUpdate so devolve lancamentos do dono (id alheio some)', async () => {
    await seedBoth();
    const found = await infra.uow.run(async ({ entries }) => (entries as any).findByIdsForUpdate(A, [entryId(1), entryId(11)]));
    expect(found.map((e: { id: { value: string } }) => e.id.value)).toEqual([entryUuid(1)]);
  });

  it('findPendingByInvoiceForUpdate so devolve as despesas pendentes do dono', async () => {
    await seedBoth();
    const key = (n: number) => ({ cardId: cardId(n), referenceMonth: MONTH }) as InvoiceKey;
    const own = await infra.uow.run(async ({ entries }) => (entries as any).findPendingByInvoiceForUpdate(A, key(1)));
    const foreign = await infra.uow.run(async ({ entries }) => (entries as any).findPendingByInvoiceForUpdate(A, key(2)));
    expect(own).toHaveLength(1);
    expect(foreign).toEqual([]);
  });

  it('CA31: PayEntriesInBatch real com id de outro dono -> ENTRIES_NOT_FOUND [B1] e nada e pago', async () => {
    await insertOwnedEntry(pool, ANA, { n: 1, status: 'PENDING', paidAt: null });
    await insertOwnedEntry(pool, BRUNO, { n: 2, status: 'PENDING', paidAt: null });
    const error = await rejected(infra.useCases.payBatch().execute({ ownerId: ANA, ids: [entryUuid(1), entryUuid(2)] } as never));
    expect(error).toMatchObject({ code: 'ENTRIES_NOT_FOUND', details: { missingIds: [entryUuid(2)] } });
    const rows = await query<{ status: string }>(pool, 'SELECT status FROM entries');
    expect(rows.map((r) => r.status)).toEqual(['PENDING', 'PENDING']);
  });

  it('CA30: PayInvoice real de cartao de outro dono -> CARD_NOT_FOUND; as despesas do outro continuam PENDING', async () => {
    await seedBoth();
    const error = await rejected(infra.useCases.payInvoice().execute({ ownerId: ANA, cardId: cardUuid(2), referenceMonth: '2026-11' } as never));
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND' });
    expect((await query<{ status: string }>(pool, `SELECT status FROM entries WHERE id = $1`, [entryUuid(13)]))[0].status).toBe('PENDING');
  });

  it('saveAll nao altera lancamento de outro dono (WHERE user_id)', async () => {
    await insertOwnedEntry(pool, BRUNO, { n: 2, status: 'PENDING', paidAt: null });
    const forged = ownedEntry(ana, 2, { paid: false });
    forged.markAsPaid(new Date('2026-10-06T10:00:00.000Z'));
    await infra.entries.saveAll([forged]).catch(() => undefined);
    expect((await query<{ status: string }>(pool, 'SELECT status FROM entries'))[0].status).toBe('PENDING');
  });

  it('CA33: catalogo devolve a grafia do PRIMEIRO uso do dono', async () => {
    await insertOwnedEntry(pool, BRUNO, { n: 1, category: 'alimentação', createdAt: '2026-10-01T10:00:00.000Z' });
    await insertOwnedEntry(pool, ANA, { n: 2, category: 'Alimentação', createdAt: '2026-10-02T10:00:00.000Z' });
    expect((await (infra.catalog as any).findByKey(A, 'alimentação'))?.value).toBe('Alimentação');
    expect((await (infra.catalog as any).findByKey(B, 'alimentação'))?.value).toBe('alimentação');
    expect(await (infra.catalog as any).findByKey(A, 'mercado')).toBeNull();
  });
});

describe('Read models com dono (CA29, CA37, RNF06)', () => {
  it('resumo mensal: Ana income 5000.00 / despesas 600.00 + 250.00; Bruno 100.00 / 50.00 + 70.00', async () => {
    await seedBoth();
    const a = await rm.summary.summary(A, MONTH);
    const b = await rm.summary.summary(B, MONTH);
    expect([a.income.toString(), a.paidExpenses.toString(), a.pendingExpenses.toString()]).toEqual(['5000.00', '600.00', '250.00']);
    expect([b.income.toString(), b.paidExpenses.toString(), b.pendingExpenses.toString()]).toEqual(['100.00', '50.00', '70.00']);
  });

  it('despesas: lista, total e subtotal consideram so o dono', async () => {
    await seedBoth();
    const a = await rm.entries.listExpenses(A, { month: MONTH, card: any, paging });
    expect(a.items.map((e: { id: string }) => e.id).sort()).toEqual([entryUuid(2), entryUuid(3)]);
    expect(a.totalItems).toBe(2);
    expect([a.subtotal.paid.toString(), a.subtotal.pending.toString()]).toEqual(['600.00', '250.00']);
    const b = await rm.entries.listExpenses(B, { month: MONTH, card: any, paging });
    expect(b.items.map((e: { id: string }) => e.id).sort()).toEqual([entryUuid(12), entryUuid(13)]);
  });

  it('filtro cardId com cartao de OUTRO dono -> lista vazia (igual cartao inexistente)', async () => {
    await seedBoth();
    const r = await rm.entries.listExpenses(A, { month: MONTH, card: { kind: 'card', cardId: cardId(2) }, paging });
    expect(r.items).toEqual([]);
    expect(r.totalItems).toBe(0);
  });

  it('filtro por categoria nao enxerga categoria de outro dono', async () => {
    await seedBoth();
    const r = await rm.entries.listExpenses(A, { month: MONTH, categoryKey: 'mercado', card: any, paging });
    expect(r.items).toEqual([]);
  });

  it('receitas: lista e subtotal so do dono', async () => {
    await seedBoth();
    const a = await rm.entries.listIncomes(A, { month: MONTH, paging });
    expect(a.items.map((e: { id: string }) => e.id)).toEqual([entryUuid(1)]);
    expect(a.subtotal.toString()).toBe('5000.00');
    expect((await rm.entries.listIncomes(B, { month: MONTH, paging })).subtotal.toString()).toBe('100.00');
  });

  it('findById de lancamento: dono acha, outro dono -> null', async () => {
    await seedBoth();
    expect((await rm.entries.findById(A, entryId(1)))?.id).toBe(entryUuid(1));
    expect(await rm.entries.findById(B, entryId(1))).toBeNull();
  });

  it('faturas: listByMonth e listEntries so do dono; cartao de outro dono -> vazio', async () => {
    await seedBoth();
    const a = await rm.invoices.listByMonth(A, { month: MONTH });
    expect(a).toHaveLength(1);
    expect(a[0].card.name).toBe('Nubank');
    expect((await rm.invoices.listByMonth(B, { month: MONTH }))[0].card.name).toBe('Itau');
    const own = await rm.invoices.listEntries(A, { cardId: cardId(1), referenceMonth: MONTH });
    expect(own.map((e: { id: string }) => e.id)).toEqual([entryUuid(3)]);
    expect(await rm.invoices.listEntries(A, { cardId: cardId(2), referenceMonth: MONTH })).toEqual([]);
  });

  it('faturas com status: o filtro tambem respeita o dono (CA23/RNF04)', async () => {
    await seedBoth(); // Ana: fatura pendente (Nubank); Bruno: fatura pendente (Itau)
    expect((await rm.invoices.listByMonth(A, { month: MONTH, status: 'PENDING' })).map((r: { card: { name: string } }) => r.card.name)).toEqual(['Nubank']);
    expect(await rm.invoices.listByMonth(A, { month: MONTH, status: 'PAID' })).toEqual([]);
    expect((await rm.invoices.listByMonth(B, { month: MONTH, status: 'PENDING' })).map((r: { card: { name: string } }) => r.card.name)).toEqual(['Itau']);
  });

  it('categorias: listDistinct so do dono', async () => {
    await seedBoth();
    expect([...(await rm.categories.listDistinct(A))].sort()).toEqual(['Lazer', 'Moradia', 'Salario']);
    expect([...(await rm.categories.listDistinct(B))].sort()).toEqual(['Bonus', 'Mercado', 'Viagem']);
  });

  it('dashboard: serie mensal e distribuicao por categoria so do dono', async () => {
    await seedBoth();
    const series = await rm.dashboard.monthlySeries(A, month('2025-12'), MONTH);
    const nov = series.find((p: { month: ReferenceMonth }) => p.month.toString() === '2026-11');
    expect(nov.totals.income.toString()).toBe('5000.00');
    const dist = await rm.dashboard.expenseDistribution(B, MONTH);
    expect(dist.map((d: { category: string }) => d.category).sort()).toEqual(['Mercado', 'Viagem']);
    expect(dist.some((d: { category: string }) => ['Moradia', 'Lazer'].includes(d.category))).toBe(false);
  });

  it('usuario sem dados recebe zeros e listas vazias (nunca os dados de outro)', async () => {
    await seedBoth();
    await insertUser(pool, { n: 3, name: 'Carla', email: 'carla@exemplo.com' });
    const carla = unwrap(await import('@finance/domain/owner/owner-id.js').then((m) => m.OwnerId.create('0a000000-0000-7000-8000-000000000003')));
    const s = await rm.summary.summary(carla, MONTH);
    expect([s.income.toString(), s.paidExpenses.toString(), s.pendingExpenses.toString()]).toEqual(['0.00', '0.00', '0.00']);
    expect(await rm.cards.listAll(carla)).toEqual([]);
    expect(await rm.categories.listDistinct(carla)).toEqual([]);
  });
});

describe('triggers de mesmo dono (D6)', () => {
  it('lancamento no cartao de outro dono e rejeitado pelo banco', async () => {
    await seedBoth();
    await expect(
      insertOwnedEntry(pool, ANA, cardEntry(50, 2, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05' })),
    ).rejects.toBeDefined();
  });

  it('o dono de um cartao nao pode ser trocado; o de um lancamento tambem nao pode ser incoerente com o cartao', async () => {
    await seedBoth();
    await expect(pool.query(`UPDATE cards SET user_id = $1 WHERE id = $2`, [BRUNO, cardUuid(1)])).rejects.toBeDefined();
    await expect(pool.query(`UPDATE entries SET user_id = $1 WHERE id = $2`, [BRUNO, entryUuid(3)])).rejects.toBeDefined();
  });

  it('o dono nao pode ser nulo e a FK exige usuario existente', async () => {
    await expect(pool.query(`INSERT INTO cards (id, user_id, name, name_key, closing_day, due_day, created_at, updated_at)
      VALUES ('c0000000-0000-7000-8000-000000000077', NULL, 'X', 'x', 1, 2, now(), now())`)).rejects.toMatchObject({ code: '23502' });
    await expect(insertOwnedCard(pool, '0a000000-0000-7000-8000-0000000000ff', { n: 78 })).rejects.toMatchObject({ code: '23503' });
  });
});

void ownedIncome;
void ownedCardExpense;
