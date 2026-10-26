import { startE2eApp, type E2eApp } from '../support/e2e-app.js';

let e: E2eApp;
beforeAll(async () => {
  e = await startE2eApp();
});
afterAll(() => e.close());
beforeEach(() => e.reset());

const fieldsOf = (res: { body: any }) => res.body.details.fields as { field: string; code: string }[];
const entry = { type: 'EXPENSE', description: 'X', category: 'Y', date: '2026-10-05', amount: '1.00', paymentMethod: 'PIX' };

describe('limites de entrada (code review)', () => {
  it('page gigante -> 400 OUT_OF_RANGE (e nao 500)', async () => {
    const res = await e.http().get('/api/entries/expenses').query({ month: '2026-10', page: '99999999999' });
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field: 'page', code: 'OUT_OF_RANGE' }));
    const inc = await e.http().get('/api/entries/incomes').query({ month: '2026-10', page: '1000001' });
    expect(inc.status).toBe(400);
  });

  it('page no teto (1000000) e aceito', async () => {
    const res = await e.http().get('/api/entries/expenses').query({ month: '2026-10', page: '1000000' });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it.each([
    ['/api/summary', { month: '0001-05' }],
    ['/api/dashboard/monthly-series', { month: '0001-05' }],
    ['/api/dashboard/category-distribution', { month: '9999-12' }],
    ['/api/invoices', { month: '1899-12' }],
    ['/api/entries/expenses', { month: '9999-01' }],
  ])('%s com mes fora da faixa de negocio -> 400 OUT_OF_RANGE', async (path, query) => {
    const res = await e.http().get(path).query(query);
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field: 'month', code: 'OUT_OF_RANGE' }));
  });

  it('data de lancamento fora da faixa -> 400 OUT_OF_RANGE', async () => {
    for (const date of ['9999-12-31', '1899-12-31', '0001-01-01']) {
      const res = await e.http().post('/api/entries').send({ ...entry, date });
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field: 'date', code: 'OUT_OF_RANGE' }));
    }
    expect((await e.http().post('/api/entries').send({ ...entry, date: '9998-12-31' })).status).toBe(201);
  });

  it('referenceMonth do pagamento de fatura fora da faixa -> 400', async () => {
    const card = (await e.http().post('/api/cards').send({ name: 'C', closingDay: 1, dueDay: 2 })).body;
    const res = await e.http().post(`/api/cards/${card.id}/invoices/0001-05/pay`);
    expect(res.status).toBe(400);
  });
});

describe('erros de transporte', () => {
  it('path com percent-encoding invalido -> 400 VALIDATION_ERROR (nao MALFORMED_JSON)', async () => {
    const res = await e.http().post('/api/entries/%FF/pay');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field: 'path', code: 'INVALID_FORMAT' }));
  });

  it('payload acima do limite -> 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await e.http().post('/api/entries').send({ ...entry, description: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ code: 'PAYLOAD_TOO_LARGE', message: expect.any(String), details: null });
  });
});
