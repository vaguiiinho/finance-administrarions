import { UUID_V7, type E2eApp } from '../support/e2e-app.js';
import { startFinanceE2e } from '../support/finance-e2e.js';
import { query } from '../support/db.js';

let e: E2eApp;
beforeAll(async () => {
  e = await startFinanceE2e();
});
afterAll(() => e.close());
beforeEach(() => e.reset());

const create = (body: Record<string, unknown>) => e.http().post('/api/cards').send(body);
const fields = (res: { body: any }) => res.body.details.fields as { field: string; code: string; message: string }[];

describe('C1 POST /api/cards', () => {
  it('CA01: 201 com CardDto e id UUID v7', async () => {
    const res = await create({ name: 'Nubank', closingDay: 25, dueDay: 5 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.stringMatching(UUID_V7),
      name: 'Nubank',
      closingDay: 25,
      dueDay: 5,
      createdAt: '2026-10-05T13:00:00.000Z',
      updatedAt: '2026-10-05T13:00:00.000Z',
    });
  });

  it.each([
    ['nome vazio', { name: '', closingDay: 25, dueDay: 5 }, 'name', 'REQUIRED'],
    ['nome com 51 caracteres', { name: 'a'.repeat(51), closingDay: 25, dueDay: 5 }, 'name', 'TOO_LONG'],
    ['fechamento 0', { name: 'X', closingDay: 0, dueDay: 5 }, 'closingDay', 'OUT_OF_RANGE'],
    ['fechamento 32', { name: 'X', closingDay: 32, dueDay: 5 }, 'closingDay', 'OUT_OF_RANGE'],
    ['vencimento 0', { name: 'X', closingDay: 5, dueDay: 0 }, 'dueDay', 'OUT_OF_RANGE'],
    ['vencimento 32', { name: 'X', closingDay: 5, dueDay: 32 }, 'dueDay', 'OUT_OF_RANGE'],
    ['fechamento 10.5', { name: 'X', closingDay: 10.5, dueDay: 5 }, 'closingDay', 'NOT_INTEGER'],
    ['fechamento "10" (string)', { name: 'X', closingDay: '10', dueDay: 5 }, 'closingDay', 'INVALID_TYPE'],
    ['vencimento "10" (string)', { name: 'X', closingDay: 5, dueDay: '10' }, 'dueDay', 'INVALID_TYPE'],
    ['nome numerico', { name: 123, closingDay: 5, dueDay: 5 }, 'name', 'INVALID_TYPE'],
    ['sem nome', { closingDay: 5, dueDay: 5 }, 'name', 'REQUIRED'],
    ['sem fechamento', { name: 'X', dueDay: 5 }, 'closingDay', 'REQUIRED'],
    ['campo desconhecido', { name: 'X', closingDay: 5, dueDay: 5, limit: 100 }, 'limit', 'UNKNOWN_FIELD'],
  ])('CA02: %s -> 400 com details por campo', async (_label, body, field, code) => {
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.any(String) });
    expect(fields(res)).toContainEqual(expect.objectContaining({ field, code }));
    expect(await query(e.pool, 'SELECT 1 FROM cards')).toHaveLength(0);
  });

  it('CA02: 50 caracteres e dias 1 e 31 sao aceitos', async () => {
    expect((await create({ name: 'a'.repeat(50), closingDay: 1, dueDay: 31 })).status).toBe(201);
  });

  it('CA03: nome duplicado (" nubank ") -> 409 CARD_NAME_TAKEN com details.fields[0].field = "name"; nenhum cartao novo', async () => {
    await create({ name: 'Nubank', closingDay: 25, dueDay: 5 });
    const res = await create({ name: ' nubank ', closingDay: 1, dueDay: 2 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CARD_NAME_TAKEN');
    expect(res.body.details.fields[0]).toMatchObject({ field: 'name', code: 'NAME_TAKEN' });
    expect(await query(e.pool, 'SELECT 1 FROM cards')).toHaveLength(1);
  });

  it('JSON malformado -> 400 MALFORMED_JSON', async () => {
    const res = await e.http().post('/api/cards').set('Content-Type', 'application/json').send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MALFORMED_JSON');
  });
});

describe('C2 GET /api/cards', () => {
  it('CA04: ordenado por nome (acentos corretos) com dias de fechamento e vencimento', async () => {
    await create({ name: 'Nubank', closingDay: 25, dueDay: 5 });
    await create({ name: 'Itaú', closingDay: 3, dueDay: 10 });
    await create({ name: 'Ágil', closingDay: 1, dueDay: 2 });
    const res = await e.http().get('/api/cards');
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { name: string }) => c.name)).toEqual(['Ágil', 'Itaú', 'Nubank']);
    expect(res.body.items[1]).toMatchObject({ closingDay: 3, dueDay: 10 });
  });

  it('lista vazia', async () => {
    expect((await e.http().get('/api/cards')).body).toEqual({ items: [] });
  });
});

describe('C3 PUT /api/cards/:id', () => {
  it('substitui os tres campos e atualiza updatedAt', async () => {
    const { body: card } = await create({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    e.clock.set(new Date('2026-10-06T09:30:00.000Z'));
    const res = await e.http().put(`/api/cards/${card.id}`).send({ name: 'Nubank', closingDay: 20, dueDay: 25 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: card.id, closingDay: 20, dueDay: 25, createdAt: card.createdAt, updatedAt: '2026-10-06T09:30:00.000Z' });
    e.clock.set(new Date('2026-10-05T13:00:00.000Z'));
  });

  it('CA06: id inexistente -> 404 CARD_NOT_FOUND no formato { code, message, details }', async () => {
    const res = await e.http().put('/api/cards/0192f1e2-0000-7000-8000-000000000999').send({ name: 'X', closingDay: 1, dueDay: 2 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'CARD_NOT_FOUND', message: expect.any(String), details: { id: '0192f1e2-0000-7000-8000-000000000999' } });
  });

  it('id mal formado -> 400', async () => {
    const res = await e.http().put('/api/cards/abc').send({ name: 'X', closingDay: 1, dueDay: 2 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('corpo invalido -> 400; nome de OUTRO cartao -> 409; precedencia 404 > 409', async () => {
    const { body: a } = await create({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    const { body: b } = await create({ name: 'Itau', closingDay: 10, dueDay: 17 });
    expect((await e.http().put(`/api/cards/${b.id}`).send({ name: '', closingDay: 10, dueDay: 17 })).status).toBe(400);
    const conflict = await e.http().put(`/api/cards/${b.id}`).send({ name: 'NUBANK', closingDay: 10, dueDay: 17 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('CARD_NAME_TAKEN');
    const missing = await e.http().put('/api/cards/0192f1e2-0000-7000-8000-000000000999').send({ name: 'Nubank', closingDay: 1, dueDay: 2 });
    expect(missing.status).toBe(404);
    expect(a.id).not.toBe(b.id);
  });

  it('PUT sem mudanca e idempotente (200)', async () => {
    const { body: card } = await create({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    const res = await e.http().put(`/api/cards/${card.id}`).send({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBe(card.updatedAt);
  });

  it('CA05 (fluxo HTTP): editar o cartao nao recalcula lancamentos existentes', async () => {
    const { body: card } = await create({ name: 'C', closingDay: 10, dueDay: 17 });
    const entry = { type: 'EXPENSE', description: 'Compra', category: 'Lazer', date: '2026-10-15', amount: '10.00', paymentMethod: 'CARD', cardId: card.id };
    const first = await e.http().post('/api/entries').send(entry);
    expect(first.body).toMatchObject({ referenceMonth: '2026-11', invoice: { closingDate: '2026-11-10', dueDate: '2026-11-17' } });
    await e.http().put(`/api/cards/${card.id}`).send({ name: 'C', closingDay: 20, dueDay: 25 });
    const second = await e.http().post('/api/entries').send(entry);
    expect(second.body).toMatchObject({ referenceMonth: '2026-10', invoice: { closingDate: '2026-10-20', dueDate: '2026-10-25' } });
    const nov = await e.http().get('/api/entries/expenses').query({ month: '2026-11' });
    expect(nov.body.items[0]).toMatchObject({ id: first.body.id, referenceMonth: '2026-11', invoice: { dueDate: '2026-11-17' } });
    const [row] = await query<{ due: string }>(e.pool, `SELECT due_date::text AS due FROM entries WHERE id = $1::uuid`, [first.body.id]);
    expect(row.due).toBe('2026-11-17');
  });
});
