import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';

let e: IdentityE2e;
let tokens: { ana: string; bruno: string; vagner: string };
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser(CAST.ana); // USER
  await e.seedUser(CAST.bruno); // USER
  await e.seedUser(CAST.vagner); // ADMIN
  tokens = { ana: await e.sessionFor(idOf(1)), bruno: await e.sessionFor(idOf(2)), vagner: await e.sessionFor(idOf(4)) };
});

const body = (over: object = {}) => ({ type: 'EXPENSE', description: 'Padaria', category: 'Alimentação', date: '2026-10-05', amount: '12.50', paymentMethod: 'PIX', ...over });
const create = async (token: string, over: object = {}) => (await e.http().post('/api/entries').set(bearer(token)).send(body(over))).body as { id: string };
const edit = { description: 'Mercado', category: 'Alimentação', date: '2026-10-06', amount: '230.50' };
const put = (token: string, id: string, b: object = edit) => e.http().put(`/api/entries/${id}`).set(bearer(token)).send(b);
const del = (token: string, id: string) => e.http().delete(`/api/entries/${id}`).set(bearer(token));
const stored = async (id: string) => (await e.pool.query('SELECT description, amount::text AS amount, "date"::text AS date FROM entries WHERE id = $1::uuid', [id])).rows[0];

describe('CA50: USER edita e exclui o proprio lancamento (B6)', () => {
  it('PUT -> 200 (nao 403) e os dados mudam', async () => {
    const { id } = await create(tokens.bruno);
    const res = await put(tokens.bruno, id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'Mercado', amount: '230.50', date: '2026-10-06' });
  });

  it('DELETE -> 204 (nao 403) e a linha some', async () => {
    const { id } = await create(tokens.bruno);
    expect((await del(tokens.bruno, id)).status).toBe(204);
    expect(await stored(id)).toBeUndefined();
  });

  it('editar uma despesa paga no cartao tambem funciona (so a data trava)', async () => {
    const card = (await e.http().post('/api/cards').set(bearer(tokens.bruno)).send({ name: 'Nubank', closingDay: 25, dueDay: 5 })).body;
    const { id } = await create(tokens.bruno, { paymentMethod: 'CARD', cardId: card.id });
    await e.http().post(`/api/entries/${id}/pay`).set(bearer(tokens.bruno));
    expect((await put(tokens.bruno, id, { ...edit, date: '2026-10-05' })).status).toBe(200);
    const locked = await put(tokens.bruno, id, { ...edit, date: '2026-10-07' });
    expect(locked.status).toBe(422);
    expect(locked.body.code).toBe('PAID_CARD_EXPENSE_DATE_LOCKED');
  });

  it('regressao: ADMIN continua editando e excluindo os proprios lancamentos', async () => {
    const { id } = await create(tokens.vagner);
    expect((await put(tokens.vagner, id)).status).toBe(200);
    expect((await del(tokens.vagner, id)).status).toBe(204);
  });
});

describe('CA51: nenhum nivel alcanca lancamento de outro usuario (404, nunca 403)', () => {
  it.each([
    ['USER (Bruno)', 'bruno'],
    ['ADMIN (Vagner)', 'vagner'],
  ] as const)('%s editando o lancamento de Ana -> 404 ENTRY_NOT_FOUND e nada muda', async (_l, who) => {
    const { id } = await create(tokens.ana);
    const before = await stored(id);
    const res = await put(tokens[who], id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ENTRY_NOT_FOUND');
    expect(await stored(id)).toEqual(before);
  });

  it.each([
    ['USER (Bruno)', 'bruno'],
    ['ADMIN (Vagner)', 'vagner'],
  ] as const)('%s excluindo o lancamento de Ana -> 404 ENTRY_NOT_FOUND e a linha continua', async (_l, who) => {
    const { id } = await create(tokens.ana);
    const res = await del(tokens[who], id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ENTRY_NOT_FOUND');
    expect(await stored(id)).toBeDefined();
  });

  it('a resposta para id de outro dono e identica a de id inexistente (nao revela existencia)', async () => {
    const { id } = await create(tokens.ana);
    const other = await put(tokens.bruno, id);
    const missing = await put(tokens.bruno, 'e0000000-0000-7000-8000-0000000000ff');
    const missingId = 'e0000000-0000-7000-8000-0000000000ff';
    expect(other.status).toBe(404);
    expect(other.status).toBe(missing.status);
    expect(other.body.details).toEqual({ id });
    expect(missing.body.details).toEqual({ id: missingId });
    const strip = (b: { details?: unknown } & Record<string, unknown>) => ({ ...b, details: undefined });
    expect(strip(other.body)).toEqual(strip(missing.body));
  });

  it('pagar lancamento de outro dono tambem e 404', async () => {
    const { id } = await create(tokens.ana, { paid: false });
    expect((await e.http().post(`/api/entries/${id}/pay`).set(bearer(tokens.bruno))).status).toBe(404);
  });
});

describe('CA52: receitas continuam sem edicao e exclusao', () => {
  it('USER: PUT -> 422 ENTRY_NOT_EDITABLE e DELETE -> 422 ENTRY_NOT_DELETABLE', async () => {
    const { id } = await create(tokens.bruno, { type: 'INCOME', description: 'Salário', category: 'Trabalho' });
    const p = await put(tokens.bruno, id);
    expect(p.status).toBe(422);
    expect(p.body.code).toBe('ENTRY_NOT_EDITABLE');
    const d = await del(tokens.bruno, id);
    expect(d.status).toBe(422);
    expect(d.body.code).toBe('ENTRY_NOT_DELETABLE');
  });
});

describe('precedencia: 401 > 400 > 404 (sem 403 para quem autentica)', () => {
  it('sem sessao -> 401', async () => {
    expect((await e.http().put(`/api/entries/${idOf(1)}`).send(edit)).status).toBe(401);
  });
  it('USER com corpo invalido -> 400 (antes era 403)', async () => {
    const { id } = await create(tokens.bruno);
    expect((await put(tokens.bruno, id, { lixo: true })).status).toBe(400);
  });
  it('USER com id malformado -> 400 e com id inexistente -> 404', async () => {
    expect((await put(tokens.bruno, 'invalido')).status).toBe(400);
    expect((await put(tokens.bruno, 'e0000000-0000-7000-8000-0000000000ff')).status).toBe(404);
  });
});
