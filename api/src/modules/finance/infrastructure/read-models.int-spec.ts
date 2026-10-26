import type pg from 'pg';
import fc from 'fast-check';
import { buildInfra, type Infra } from '@test/support/infra.js';
import { cardEntry, cardUuid, createPool, entryUuid, insertCard, insertEntry, query, resetDb, type EntryRow } from '@test/support/db.js';
import { cardId } from '@test/support/builders.js';
import { unwrap } from '@test/support/result.js';
import { ReferenceMonth } from '@finance/domain/billing/reference-month.js';
import { InvoiceKey } from '@finance/domain/billing/invoice-key.js';
import { FinancialTotals } from '@finance/domain/totals/financial-totals.js';
import { ExpenseTotals } from '@finance/domain/totals/expense-totals.js';
import { Money } from '@shared/domain/value-objects/money.js';

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

const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));
const paging = (page = 1, pageSize = 20) => ({ page, pageSize });
const any = { kind: 'any' } as const;
const expenses = (month: string, extra: Record<string, unknown> = {}) =>
  infra.readModels.entries.listExpenses({ month: rm(month), card: any, paging: paging(), ...extra } as never);
const incomes = (month: string, extra: Record<string, unknown> = {}) =>
  infra.readModels.entries.listIncomes({ month: rm(month), paging: paging(), ...extra } as never);
const idsOf = (page: { items: { id: string }[] }) => page.items.map((i) => i.id);
const pending = (n: number, o: Partial<EntryRow> = {}): EntryRow => ({ n, status: 'PENDING', paidAt: null, ...o });
const NOV = { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05' };

describe('EntryReadModel.listExpenses (E2)', () => {
  it('CA46: 25 despesas -> pagina 1 com 20, ordenada por date DESC, created_at DESC, id DESC; pagina 2 com 5', async () => {
    // datas repetidas para exercitar o desempate por created_at e id
    for (let n = 1; n <= 25; n++) {
      await insertEntry(pool, {
        n,
        date: `2026-10-${String(1 + (n % 7)).padStart(2, '0')}`,
        createdAt: `2026-10-05T13:00:${String(n % 3).padStart(2, '0')}.000Z`,
      });
    }
    const page1 = await expenses('2026-10');
    const page2 = await expenses('2026-10', { paging: paging(2) });
    expect(page1.items).toHaveLength(20);
    expect(page1.totalItems).toBe(25);
    expect(page2.items).toHaveLength(5);
    const expected = await query<{ id: string }>(
      pool,
      `SELECT id FROM entries ORDER BY "date" DESC, created_at DESC, id DESC`,
    );
    expect([...idsOf(page1), ...idsOf(page2)]).toEqual(expected.map((r) => r.id));
  });

  it('pagina alem do fim -> items vazio, totalItems correto', async () => {
    await insertEntry(pool, { n: 1 });
    const page = await expenses('2026-10', { paging: paging(5) });
    expect(page.items).toEqual([]);
    expect(page.totalItems).toBe(1);
  });

  it('CA50: subtotal cobre TODO o conjunto filtrado (30 "Moradia"), nao so a pagina de 20', async () => {
    for (let n = 1; n <= 30; n++) {
      await insertEntry(pool, n <= 10 ? { n, category: 'Moradia', amount: '10.00' } : pending(n, { category: 'Moradia', amount: '20.00' }));
    }
    await insertEntry(pool, { n: 100, category: 'Lazer', amount: '999.00' });
    const page = await expenses('2026-10', { categoryKey: 'moradia' });
    expect(page.items).toHaveLength(20);
    expect(page.totalItems).toBe(30);
    expect(page.subtotal.paid.toString()).toBe('100.00');
    expect(page.subtotal.pending.toString()).toBe('400.00');
  });

  it('CA53: compra no cartao de 10/10 aparece em 2026-11; PIX de 20/10 fica fora', async () => {
    await insertCard(pool, { n: 1 });
    await insertEntry(pool, cardEntry(1, 1, { ...NOV }));
    await insertEntry(pool, { n: 2, date: '2026-10-20' });
    const nov = await expenses('2026-11');
    expect(idsOf(nov)).toEqual([entryUuid(1)]);
    expect(nov.items[0].referenceMonth.toString()).toBe('2026-11');
    expect(nov.items[0].date.toString()).toBe('2026-10-10');
    expect(idsOf(await expenses('2026-10'))).toEqual([entryUuid(2)]);
  });

  it('CA54: filtro por status; subtotal do filtro (pagas 0.00 em PENDING)', async () => {
    await insertEntry(pool, { n: 1, amount: '30.00' });
    await insertEntry(pool, pending(2, { amount: '70.00' }));
    const onlyPending = await expenses('2026-10', { status: 'PENDING' });
    expect(idsOf(onlyPending)).toEqual([entryUuid(2)]);
    expect(onlyPending.subtotal.paid.toString()).toBe('0.00');
    expect(onlyPending.subtotal.pending.toString()).toBe('70.00');
    const onlyPaid = await expenses('2026-10', { status: 'PAID' });
    expect(idsOf(onlyPaid)).toEqual([entryUuid(1)]);
    expect(onlyPaid.subtotal.pending.toString()).toBe('0.00');
  });

  it('CA55: filtro por cartao e "PIX/sem cartao"', async () => {
    await insertCard(pool, { n: 1, name: 'C1' });
    await insertCard(pool, { n: 2, name: 'C2' });
    await insertEntry(pool, cardEntry(1, 1, { ...NOV, amount: '10.00' }));
    await insertEntry(pool, cardEntry(2, 2, { ...NOV, amount: '20.00' }));
    await insertEntry(pool, { n: 3, date: '2026-11-03', amount: '5.00' });
    const c1 = await expenses('2026-11', { card: { kind: 'card', cardId: cardId(1) } });
    expect(idsOf(c1)).toEqual([entryUuid(1)]);
    expect(c1.subtotal.pending.toString()).toBe('10.00');
    expect(c1.items[0].card).toEqual({ id: cardUuid(1), name: 'C1' });
    const pix = await expenses('2026-11', { card: { kind: 'pix' } });
    expect(idsOf(pix)).toEqual([entryUuid(3)]);
    expect(pix.items[0].card).toBeNull();
    expect(pix.items[0].invoice).toBeNull();
  });

  it('CA56: categoria case-insensitive pela chave; so despesas', async () => {
    await insertEntry(pool, { n: 1, category: 'Moradia' });
    await insertEntry(pool, { n: 2, category: 'Alimentação' });
    await insertEntry(pool, { n: 3, type: 'INCOME', category: 'Moradia' });
    const page = await expenses('2026-10', { categoryKey: 'moradia' });
    expect(idsOf(page)).toEqual([entryUuid(1)]);
  });

  it('CA58: sem correspondencia -> vazio e subtotais 0.00; cartao inexistente idem (P19)', async () => {
    await insertEntry(pool, { n: 1 });
    const empty = await expenses('2026-10', { categoryKey: 'nada' });
    expect(empty.items).toEqual([]);
    expect(empty.totalItems).toBe(0);
    expect(empty.subtotal.paid.toString()).toBe('0.00');
    expect(empty.subtotal.pending.toString()).toBe('0.00');
    const ghost = await expenses('2026-10', { card: { kind: 'card', cardId: cardId(77) } });
    expect(ghost.totalItems).toBe(0);
  });

  it('view completa: campos, nome ATUAL do cartao apos edicao e datas sem deslocamento (CA23)', async () => {
    await insertCard(pool, { n: 1, name: 'Nubank' });
    await insertEntry(pool, cardEntry(1, 1, { date: '2026-10-31', closing: '2026-11-25', due: '2026-12-05', amount: '1234.56', category: 'Alimentação' }));
    await pool.query(`UPDATE cards SET name = 'Nubank Renomeado', name_key = 'nubank renomeado'`);
    const [item] = (await expenses('2026-12')).items;
    expect(item).toMatchObject({
      id: entryUuid(1),
      type: 'EXPENSE',
      category: 'Alimentação',
      paymentMethod: 'CARD',
      status: 'PENDING',
      paidAt: null,
    });
    expect(item.amount.toString()).toBe('1234.56');
    expect(item.date.toString()).toBe('2026-10-31');
    expect(item.invoice?.closingDate.toString()).toBe('2026-11-25');
    expect(item.invoice?.dueDate.toString()).toBe('2026-12-05');
    expect(item.referenceMonth.toString()).toBe('2026-12');
    expect(item.card).toEqual({ id: cardUuid(1), name: 'Nubank Renomeado' });
    expect(item.createdAt).toBeInstanceOf(Date);
  });

  it('findById: view ou null', async () => {
    await insertEntry(pool, { n: 1 });
    expect((await infra.readModels.entries.findById({ value: entryUuid(1) } as never))?.id).toBe(entryUuid(1));
    expect(await infra.readModels.entries.findById({ value: entryUuid(9) } as never)).toBeNull();
  });
});

describe('EntryReadModel.listIncomes (E3)', () => {
  it('CA53: receita de 05/11 em 2026-11; subtotal Money; so receitas', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', date: '2026-11-05', amount: '5000.00', category: 'Salário' });
    await insertEntry(pool, { n: 2, type: 'INCOME', date: '2026-10-30', amount: '1.00' });
    await insertEntry(pool, { n: 3, date: '2026-11-05' });
    const page = await incomes('2026-11');
    expect(idsOf(page)).toEqual([entryUuid(1)]);
    expect(page.subtotal.toString()).toBe('5000.00');
    expect(page.items[0]).toMatchObject({ type: 'INCOME', status: 'RECEIVED', paidAt: null, card: null });
  });

  it('CA56: categoria; subtotal considera so as receitas filtradas', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', category: 'Salário', amount: '5000.00' });
    await insertEntry(pool, { n: 2, type: 'INCOME', category: 'Extra', amount: '300.00' });
    await insertEntry(pool, { n: 3, category: 'Extra', amount: '50.00' });
    const page = await incomes('2026-10', { categoryKey: 'extra' });
    expect(idsOf(page)).toEqual([entryUuid(2)]);
    expect(page.subtotal.toString()).toBe('300.00');
  });

  it('paginacao e vazio com subtotal 0.00', async () => {
    for (let n = 1; n <= 3; n++) await insertEntry(pool, { n, type: 'INCOME' });
    const page = await incomes('2026-10', { paging: paging(2, 2) });
    expect(page.items).toHaveLength(1);
    expect(page.totalItems).toBe(3);
    expect((await incomes('2027-01')).subtotal.toString()).toBe('0.00');
  });
});

describe('MonthlySummaryReadModel (S1)', () => {
  const summary = async (m: string) => {
    const row = await infra.readModels.summary.summary(rm(m));
    return FinancialTotals.of({ income: row.income, expenses: ExpenseTotals.of({ paid: row.paidExpenses, pending: row.pendingExpenses }) });
  };

  it('CA47/CA48: receitas 5000, pagas 3000 (1000 em Moradia), pendentes 2500', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', amount: '5000.00' });
    await insertEntry(pool, { n: 2, amount: '1000.00', category: 'Moradia' });
    await insertEntry(pool, { n: 3, amount: '2000.00', category: 'Lazer' });
    await insertEntry(pool, pending(4, { amount: '2500.00' }));
    const t = await summary('2026-10');
    expect([t.income, t.expenses.total, t.expenses.paid, t.expenses.pending, t.realizedBalance, t.projectedBalance].map(String)).toEqual([
      '5000.00', '5500.00', '3000.00', '2500.00', '2000.00', '-500.00',
    ]);
  });

  it('CA10: receita de data futura entra no saldo realizado do mes', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', date: '2026-10-30', amount: '5000.00' });
    expect((await summary('2026-10')).realizedBalance.toString()).toBe('5000.00');
  });

  it('CA07/B8: PIX pago (inclusive data futura) reduz o realizado do seu mes de referencia', async () => {
    await insertEntry(pool, { n: 1, date: '2027-03-20', amount: '1500.00' });
    expect((await summary('2027-03')).realizedBalance.toString()).toBe('-1500.00');
    expect((await summary('2026-10')).realizedBalance.toString()).toBe('0.00');
  });

  it('CA52: precisao decimal 0.10 + 0.20 + 0.30 e receita 0.50', async () => {
    await insertEntry(pool, pending(1, { amount: '0.10' }));
    await insertEntry(pool, pending(2, { amount: '0.20' }));
    await insertEntry(pool, pending(3, { amount: '0.30' }));
    await insertEntry(pool, { n: 4, type: 'INCOME', amount: '0.50' });
    const t = await summary('2026-10');
    expect(t.expenses.total.toString()).toBe('0.60');
    expect(t.projectedBalance.toString()).toBe('-0.10');
  });

  it('CA51: pagar A (100.10) e B (49.90) move pendente para pago sem alterar o previsto', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', amount: '1000.00' });
    await insertEntry(pool, { n: 2, amount: '200.00' });
    await insertEntry(pool, pending(3, { amount: '150.00' }));
    await insertEntry(pool, pending(4, { amount: '100.10' }));
    await insertEntry(pool, pending(5, { amount: '49.90' }));
    const before = await summary('2026-10');
    await infra.useCases.payBatch().execute({ ids: [entryUuid(4), entryUuid(5)] });
    const after = await summary('2026-10');
    expect(after.expenses.pending.toString()).toBe('150.00');
    expect(after.expenses.paid.toString()).toBe('350.00');
    expect(after.expenses.total.toString()).toBe('500.00');
    expect(after.realizedBalance.toString()).toBe('650.00');
    expect(after.projectedBalance.toString()).toBe(before.projectedBalance.toString());
    expect(after.projectedBalance.toString()).toBe('500.00');
  });

  it('CA65/CA58: mes sem lancamentos -> "0.00" (nunca nulo)', async () => {
    const row = await infra.readModels.summary.summary(rm('2030-01'));
    expect([row.income, row.paidExpenses, row.pendingExpenses].map(String)).toEqual(['0.00', '0.00', '0.00']);
  });

  it('CA49 (propriedade): somas do banco = somas em memoria, exatas, para dados aleatorios', async () => {
    const rowArb = fc.record({
      income: fc.boolean(),
      paid: fc.boolean(),
      cents: fc.integer({ min: 1, max: 99_999_999_999 }),
      month: fc.constantFrom('2026-09', '2026-10', '2026-11'),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(rowArb, { minLength: 1, maxLength: 25 }), async (rows) => {
        await resetDb(pool);
        let n = 0;
        for (const r of rows) {
          n++;
          await insertEntry(pool, {
            n,
            type: r.income ? 'INCOME' : 'EXPENSE',
            status: r.income ? 'RECEIVED' : r.paid ? 'PAID' : 'PENDING',
            paidAt: !r.income && r.paid ? '2026-10-05T13:00:00.000Z' : null,
            date: `${r.month}-10`,
            amount: Money.fromCents(BigInt(r.cents)).toString(),
          });
        }
        const t = await summary('2026-10');
        const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
          rows.filter((r) => r.month === '2026-10' && pred(r)).reduce((acc, r) => acc + BigInt(r.cents), 0n);
        expect(t.income.toCents()).toBe(sum((r) => r.income));
        expect(t.expenses.paid.toCents()).toBe(sum((r) => !r.income && r.paid));
        expect(t.expenses.pending.toCents()).toBe(sum((r) => !r.income && !r.paid));
        expect(t.expenses.total.toCents()).toBe(t.expenses.paid.toCents() + t.expenses.pending.toCents());
      }),
      { numRuns: 15 },
    );
  }, 120_000);
});

describe('InvoiceReadModel (I1, I2)', () => {
  const list = (m: string) => infra.readModels.invoices.listByMonth(rm(m));
  const key = (cardN: number, m: string) => ({ cardId: cardId(cardN), referenceMonth: rm(m) }) as unknown as InvoiceKey;

  it('CA43: faturas A e B de 2026-11 com datas, contagens, totais e ordem por vencimento', async () => {
    await insertCard(pool, { n: 1, name: 'A', closingDay: 25, dueDay: 5 });
    await insertCard(pool, { n: 2, name: 'B', closingDay: 3, dueDay: 10 });
    await insertEntry(pool, cardEntry(1, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '100.00' }));
    await insertEntry(pool, cardEntry(2, 1, { date: '2026-10-20', closing: '2026-10-25', due: '2026-11-05', amount: '40.00', status: 'PAID' }));
    await insertEntry(pool, cardEntry(3, 2, { date: '2026-10-15', closing: '2026-11-03', due: '2026-11-10', amount: '60.00' }));
    const [a, b, ...rest] = await list('2026-11');
    expect(rest).toEqual([]);
    expect(a.card).toEqual({ id: cardUuid(1), name: 'A' });
    expect(a.referenceMonth.toString()).toBe('2026-11');
    expect(a.closingDate.toString()).toBe('2026-10-25');
    expect(a.dueDate.toString()).toBe('2026-11-05');
    expect([a.entryCount, a.pendingCount]).toEqual([2, 1]);
    expect([a.paid, a.pending].map(String)).toEqual(['40.00', '100.00']);
    expect(b.card.name).toBe('B');
    expect(b.closingDate.toString()).toBe('2026-11-03');
    expect(b.dueDate.toString()).toBe('2026-11-10');
    expect([b.entryCount, b.pendingCount]).toEqual([1, 1]);
    expect([b.paid, b.pending].map(String)).toEqual(['0.00', '60.00']);
  });

  it('CA44: cartao sem despesas no mes nao aparece; mes sem faturas -> []', async () => {
    await insertCard(pool, { n: 1, name: 'A' });
    await insertCard(pool, { n: 2, name: 'B' });
    await insertEntry(pool, cardEntry(1, 1, { ...NOV }));
    expect((await list('2026-11')).map((r) => r.card.name)).toEqual(['A']);
    expect(await list('2027-06')).toEqual([]);
  });

  it('PIX e receitas nunca formam fatura', async () => {
    await insertEntry(pool, { n: 1, date: '2026-11-10' });
    await insertEntry(pool, { n: 2, type: 'INCOME', date: '2026-11-10' });
    expect(await list('2026-11')).toEqual([]);
  });

  it('CA45: fatura toda paga continua listada com pendente 0.00 e pendingCount 0', async () => {
    await insertCard(pool, { n: 1, name: 'A' });
    await insertEntry(pool, cardEntry(1, 1, { ...NOV, status: 'PAID', amount: '70.00' }));
    const [a] = await list('2026-11');
    expect(a.pendingCount).toBe(0);
    expect(a.pending.toString()).toBe('0.00');
    expect(a.paid.toString()).toBe('70.00');
  });

  it('empate de vencimento: ordena por nome do cartao com acento (ICU), depois id', async () => {
    await insertCard(pool, { n: 1, name: 'Zeta' });
    await insertCard(pool, { n: 2, name: 'Ágil' });
    await insertCard(pool, { n: 3, name: 'Itaú' });
    for (const n of [1, 2, 3]) await insertEntry(pool, cardEntry(n, n, { ...NOV }));
    expect((await list('2026-11')).map((r) => r.card.name)).toEqual(['Ágil', 'Itaú', 'Zeta']);
  });

  it('B9: datas divergentes na mesma fatura -> maiores closingDate e dueDate; ordenacao pela dueDate exibida', async () => {
    await insertCard(pool, { n: 1, name: 'Editado' });
    await insertCard(pool, { n: 2, name: 'Normal' });
    // mesma fatura (ref 2026-11) com datas diferentes (cartao editado no meio do ciclo)
    await insertEntry(pool, cardEntry(1, 1, { date: '2026-10-10', closing: '2026-10-10', due: '2026-11-05' }));
    await insertEntry(pool, cardEntry(2, 1, { date: '2026-10-15', closing: '2026-11-20', due: '2026-11-28' }));
    await insertEntry(pool, cardEntry(3, 2, { date: '2026-10-12', closing: '2026-10-25', due: '2026-11-15' }));
    const [first, second] = await list('2026-11');
    expect(first.card.name).toBe('Normal'); // vence 15 < 28 (MAX do outro)
    expect(second.card.name).toBe('Editado');
    expect(second.closingDate.toString()).toBe('2026-11-20');
    expect(second.dueDate.toString()).toBe('2026-11-28');
    expect(second.entryCount).toBe(2);
  });

  it('CA49: soma dos totais das faturas = soma das despesas no cartao do mes, exatamente', async () => {
    await insertCard(pool, { n: 1, name: 'A' });
    await insertCard(pool, { n: 2, name: 'B' });
    await insertEntry(pool, cardEntry(1, 1, { ...NOV, amount: '0.10' }));
    await insertEntry(pool, cardEntry(2, 1, { ...NOV, amount: '0.20', status: 'PAID' }));
    await insertEntry(pool, cardEntry(3, 2, { ...NOV, amount: '123.45' }));
    await insertEntry(pool, { n: 4, date: '2026-11-02', amount: '999.00' }); // PIX nao entra
    const invoices = await list('2026-11');
    const invoiceSum = Money.sum(invoices.flatMap((i) => [i.paid, i.pending]));
    const [{ s }] = await query<{ s: string }>(pool, `SELECT SUM(amount)::text AS s FROM entries WHERE payment_method = 'CARD' AND reference_month = '2026-11-01'`);
    expect(invoiceSum.toString()).toBe(s);
    expect(invoiceSum.toString()).toBe('123.75');
  });

  it('I2/DR7: todas as despesas do bloco, sem paginacao, data desc; so do cartao e do mes', async () => {
    await insertCard(pool, { n: 1 });
    await insertCard(pool, { n: 2 });
    for (let n = 1; n <= 25; n++) {
      await insertEntry(pool, cardEntry(n, 1, { date: `2026-10-${String(1 + (n % 9)).padStart(2, '0')}`, closing: '2026-10-25', due: '2026-11-05' }));
    }
    await insertEntry(pool, cardEntry(100, 1, { date: '2026-11-10', closing: '2026-11-25', due: '2026-12-05' })); // outro mes
    await insertEntry(pool, cardEntry(101, 2, { ...NOV })); // outro cartao
    const items = await infra.readModels.invoices.listEntries(key(1, '2026-11'));
    expect(items).toHaveLength(25);
    const expected = await query<{ id: string }>(
      pool,
      `SELECT id FROM entries WHERE card_id = $1::uuid AND reference_month = '2026-11-01' ORDER BY "date" DESC, created_at DESC, id DESC`,
      [cardUuid(1)],
    );
    expect(items.map((i) => i.id)).toEqual(expected.map((r) => r.id));
    expect(await infra.readModels.invoices.listEntries(key(1, '2027-05'))).toEqual([]);
  });
});

describe('CategoryReadModel (E6) e CategoryCatalog', () => {
  it('distintas por chave entre receitas e despesas (P23), grafia do primeiro uso, ordenadas por chave', async () => {
    await insertEntry(pool, { n: 1, category: 'Alimentação', createdAt: '2026-10-05T10:00:00.000Z' });
    await insertEntry(pool, { n: 2, category: 'alimentação', createdAt: '2026-10-05T11:00:00.000Z' });
    await insertEntry(pool, { n: 3, type: 'INCOME', category: 'Salário', createdAt: '2026-10-05T12:00:00.000Z' });
    await insertEntry(pool, { n: 4, type: 'INCOME', category: 'ALIMENTAÇÃO', createdAt: '2026-10-05T13:00:00.000Z' });
    await insertEntry(pool, { n: 5, category: 'Moradia', createdAt: '2026-10-05T14:00:00.000Z' });
    expect(await infra.readModels.categories.listDistinct()).toEqual(['Alimentação', 'Moradia', 'Salário']);
  });

  it('listDistinct vazio', async () => {
    expect(await infra.readModels.categories.listDistinct()).toEqual([]);
  });

  it('CA20: catalog.findByKey devolve a grafia do primeiro uso (entre tipos) ou null', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', category: 'Salário', createdAt: '2026-10-05T10:00:00.000Z' });
    await insertEntry(pool, { n: 2, category: 'SALÁRIO', createdAt: '2026-10-05T11:00:00.000Z' });
    expect((await infra.catalog.findByKey('salário'))?.value).toBe('Salário');
    expect(await infra.catalog.findByKey('inexistente')).toBeNull();
  });
});

describe('DashboardReadModel (D2, D3)', () => {
  const series = (from: string, to: string) => infra.readModels.dashboard.monthlySeries(rm(from), rm(to));

  it('CA62: 12 pontos (2025-11..2026-10) com zeros nos meses sem dados e virada de ano', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', date: '2026-03-10', amount: '100.00' });
    await insertEntry(pool, { n: 2, date: '2026-10-10', amount: '30.00' });
    await insertEntry(pool, pending(3, { date: '2026-10-11', amount: '20.00' }));
    const points = await series('2025-11', '2026-10');
    expect(points).toHaveLength(12);
    expect(points.map((p) => p.month.toString())).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
    const byMonth = Object.fromEntries(points.map((p) => [p.month.toString(), p.totals]));
    expect(byMonth['2026-03'].income.toString()).toBe('100.00');
    expect([byMonth['2026-10'].paidExpenses, byMonth['2026-10'].pendingExpenses].map(String)).toEqual(['30.00', '20.00']);
    expect([byMonth['2025-12'].income, byMonth['2025-12'].paidExpenses, byMonth['2025-12'].pendingExpenses].map(String)).toEqual(['0.00', '0.00', '0.00']);
  });

  it('CA63: compra de 10/09 com vencimento em outubro entra em outubro, nao em setembro', async () => {
    await insertCard(pool, { n: 1 });
    await insertEntry(pool, cardEntry(1, 1, { date: '2026-09-10', closing: '2026-09-25', due: '2026-10-05', amount: '80.00' }));
    const byMonth = Object.fromEntries((await series('2026-09', '2026-10')).map((p) => [p.month.toString(), p.totals]));
    expect(byMonth['2026-10'].pendingExpenses.toString()).toBe('80.00');
    expect(byMonth['2026-09'].pendingExpenses.toString()).toBe('0.00');
  });

  it('CA59: ponto do mes e igual ao resumo (mesmos numeros)', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', amount: '5000.00' });
    await insertEntry(pool, { n: 2, amount: '800.00' });
    await insertEntry(pool, pending(3, { amount: '200.00' }));
    const [point] = await series('2026-10', '2026-10');
    const summary = await infra.readModels.summary.summary(rm('2026-10'));
    expect(point.totals.income.toString()).toBe(summary.income.toString());
    expect(point.totals.paidExpenses.toString()).toBe(summary.paidExpenses.toString());
    expect(point.totals.pendingExpenses.toString()).toBe(summary.pendingExpenses.toString());
  });

  it('CA64: distribuicao so de despesas - Moradia 75.00 e Alimentacao 25.00, sem Salario, ordem desc', async () => {
    await insertEntry(pool, { n: 1, category: 'Alimentação', amount: '500.00' });
    await insertEntry(pool, pending(2, { category: 'Moradia', amount: '1500.00' }));
    await insertEntry(pool, { n: 3, type: 'INCOME', category: 'Salário', amount: '5000.00' });
    const dist = await infra.readModels.dashboard.expenseDistribution(rm('2026-10'));
    expect(dist.map((d) => [d.category, d.total.toString(), d.percentage])).toEqual([
      ['Moradia', '1500.00', '75.00'],
      ['Alimentação', '500.00', '25.00'],
    ]);
  });

  it('agrupa categorias pela chave (case-insensitive) e usa a grafia do primeiro uso', async () => {
    await insertEntry(pool, { n: 1, category: 'Moradia', amount: '10.00', createdAt: '2026-10-05T10:00:00.000Z' });
    await insertEntry(pool, { n: 2, category: 'MORADIA', amount: '20.00', createdAt: '2026-10-05T11:00:00.000Z' });
    const dist = await infra.readModels.dashboard.expenseDistribution(rm('2026-10'));
    expect(dist).toHaveLength(1);
    expect(dist[0].category).toBe('Moradia');
    expect(dist[0].total.toString()).toBe('30.00');
    expect(dist[0].percentage).toBe('100.00');
  });

  it('percentuais com arredondamento a 2 casas (33.33)', async () => {
    for (const [n, c] of [[1, 'A'], [2, 'B'], [3, 'C']] as const) await insertEntry(pool, { n, category: c, amount: '10.00' });
    const dist = await infra.readModels.dashboard.expenseDistribution(rm('2026-10'));
    expect(dist.map((d) => d.percentage)).toEqual(['33.33', '33.33', '33.33']);
  });

  it('CA65: mes sem despesas -> lista vazia (sem divisao por zero)', async () => {
    await insertEntry(pool, { n: 1, type: 'INCOME', amount: '10.00' });
    expect(await infra.readModels.dashboard.expenseDistribution(rm('2026-10'))).toEqual([]);
  });
});
