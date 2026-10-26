import { buildHarness, type Harness } from '@test/support/finance-harness.js';
import { NOW, cardUuid, rawEntry, rejected } from '@test/support/builders.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Violation = { field: string; code: string };
const fieldsOf = (e: { details?: unknown }): Violation[] => (e.details as { fields: Violation[] }).fields;

async function cardIn(h: Harness, closingDay = 25, dueDay = 5, name = 'Nubank') {
  return h.createCard.execute({ name, closingDay, dueDay });
}

describe('CreateEntry - despesa PIX', () => {
  it('CA07: sem paid nasce PAID, paidAt = instante do clock, referencia do mes, sem fatura', async () => {
    const h = buildHarness();
    const view = await h.createEntry.execute(rawEntry());
    expect(view.id).toMatch(UUID_V7);
    expect(view).toMatchObject({
      type: 'EXPENSE',
      status: 'PAID',
      paidAt: NOW,
      createdAt: NOW,
      paymentMethod: 'PIX',
      card: null,
      invoice: null,
      category: 'Moradia',
    });
    expect(view.amount.toString()).toBe('1500.00');
    expect(view.date.toString()).toBe('2026-10-05');
    expect(view.referenceMonth.toString()).toBe('2026-10');
    expect(h.entries.store.size).toBe(1);
  });

  it('T13: paidAt e createdAt vem de UMA leitura do Clock', async () => {
    const h = buildHarness();
    await h.createEntry.execute(rawEntry());
    expect(h.clock.reads).toBe(1);
  });

  it('CA08: paid=false -> PENDING sem paidAt; paid=true igual ao CA07', async () => {
    const h = buildHarness();
    const pending = await h.createEntry.execute(rawEntry({ paid: false }));
    expect(pending.status).toBe('PENDING');
    expect(pending.paidAt).toBeNull();
    const paid = await h.createEntry.execute(rawEntry({ paid: true }));
    expect(paid.status).toBe('PAID');
    expect(paid.paidAt).toEqual(NOW);
  });

  it('B8: data futura (relogio anterior) nasce PAID com paidAt = now; paid=false -> PENDING', async () => {
    const h = buildHarness(new Date('2026-01-01T12:00:00.000Z'));
    const future = await h.createEntry.execute(rawEntry({ date: '2027-05-10' }));
    expect(future.status).toBe('PAID');
    expect(future.paidAt).toEqual(new Date('2026-01-01T12:00:00.000Z'));
    expect(future.referenceMonth.toString()).toBe('2027-05');
    const pending = await h.createEntry.execute(rawEntry({ date: '2027-05-10', paid: false }));
    expect(pending.status).toBe('PENDING');
  });
});

describe('CreateEntry - despesa no cartao', () => {
  it('CA09/CA22: PENDING, sem paidAt, view com referenceMonth, invoice e card.name', async () => {
    const h = buildHarness();
    const card = await cardIn(h, 25, 5, 'Nubank');
    const view = await h.createEntry.execute(
      rawEntry({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-10', amount: '250.00', category: 'Alimentação' }),
    );
    expect(view).toMatchObject({ status: 'PENDING', paidAt: null, paymentMethod: 'CARD' });
    expect(view.card).toEqual({ id: card.id, name: 'Nubank' });
    expect(view.referenceMonth.toString()).toBe('2026-11');
    expect(view.invoice?.closingDate.toString()).toBe('2026-10-25');
    expect(view.invoice?.dueDate.toString()).toBe('2026-11-05');
  });

  it('CA22: compra em 2026-10-26 -> fecha 25/11, vence 05/12, ref 2026-12', async () => {
    const h = buildHarness();
    const card = await cardIn(h);
    const view = await h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-26' }));
    expect(view.invoice?.closingDate.toString()).toBe('2026-11-25');
    expect(view.invoice?.dueDate.toString()).toBe('2026-12-05');
    expect(view.referenceMonth.toString()).toBe('2026-12');
  });

  it('CA09: paid=false aceito (PENDING)', async () => {
    const h = buildHarness();
    const card = await cardIn(h);
    const view = await h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: card.id, paid: false }));
    expect(view.status).toBe('PENDING');
  });

  it('CA09: paid=true no cartao com cartao INEXISTENTE -> 400 (nao 404), cartao nem e consultado, nada criado', async () => {
    const h = buildHarness();
    const error = await rejected(
      h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: cardUuid(77), paid: true })),
    );
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(fieldsOf(error)).toContainEqual(expect.objectContaining({ field: 'paid', code: 'NOT_ALLOWED_FOR_CARD' }));
    expect(h.cards.calls.findById).toBe(0);
    expect(h.entries.calls.insert).toBe(0);
  });

  it('CA13: cartao inexistente -> 404 CARD_NOT_FOUND, nada inserido nem publicado', async () => {
    const h = buildHarness();
    const missing = cardUuid(77);
    const error = await rejected(h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: missing })));
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(error.details).toEqual({ id: missing });
    expect(h.entries.calls.insert).toBe(0);
    expect(h.publisher.published).toEqual([]);
  });

  it('CA12: CARD sem cardId -> 400 em cardId; PIX com cardId -> 400', async () => {
    const h = buildHarness();
    const a = await rejected(h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: null })));
    expect(fieldsOf(a)).toContainEqual(expect.objectContaining({ field: 'cardId', code: 'REQUIRED' }));
    const card = await cardIn(h);
    const b = await rejected(h.createEntry.execute(rawEntry({ paymentMethod: 'PIX', cardId: card.id })));
    expect(fieldsOf(b)).toContainEqual(expect.objectContaining({ field: 'cardId', code: 'NOT_ALLOWED_FOR_PIX' }));
    expect(h.entries.calls.insert).toBe(0);
  });

  it('CA05: usa os dias do cartao lidos no instante da criacao', async () => {
    const h = buildHarness();
    const card = await cardIn(h, 10, 17);
    const first = await h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-15' }));
    expect(first.referenceMonth.toString()).toBe('2026-11');
    await h.updateCard.execute({ id: card.id, name: 'Nubank', closingDay: 20, dueDay: 25 });
    const second = await h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-15' }));
    expect(second.referenceMonth.toString()).toBe('2026-10');
  });
});

describe('CreateEntry - receita', () => {
  it('CA10: nasce RECEIVED, sem cartao, referencia do mes, data futura entra', async () => {
    const h = buildHarness(new Date('2026-10-24T12:00:00.000Z'));
    const view = await h.createEntry.execute(
      rawEntry({ type: 'INCOME', description: 'Salário', category: 'Salário', date: '2026-10-30', amount: '5000.00' }),
    );
    expect(view).toMatchObject({ type: 'INCOME', status: 'RECEIVED', paidAt: null, card: null, invoice: null });
    expect(view.referenceMonth.toString()).toBe('2026-10');
  });

  it('CA11: receita no cartao / com cartao / com paid -> 400 e nada criado (inclusive com cartao inexistente)', async () => {
    const h = buildHarness();
    const missing = cardUuid(77);
    const bodies = [
      rawEntry({ type: 'INCOME', paymentMethod: 'CARD', cardId: missing }),
      rawEntry({ type: 'INCOME', cardId: missing }),
      rawEntry({ type: 'INCOME', paid: true }),
      rawEntry({ type: 'INCOME', paid: false }),
    ];
    for (const body of bodies) {
      const error = await rejected(h.createEntry.execute(body));
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    }
    expect(h.entries.calls.insert).toBe(0);
    expect(h.cards.calls.findById).toBe(0);
  });
});

describe('CreateEntry - validacao e categoria', () => {
  it('CA19: acumula todas as violacoes (400) sem tocar nos repositorios', async () => {
    const h = buildHarness();
    const error = await rejected(
      h.createEntry.execute(rawEntry({ category: '', date: '2026-02-30', amount: '0', description: '' })),
    );
    const fields = new Set(fieldsOf(error).map((f) => f.field));
    expect([...fields].sort()).toEqual(['amount', 'category', 'date', 'description']);
    expect(h.entries.calls.insert).toBe(0);
  });

  it('CA20: usa a grafia canonica do primeiro uso (entre tipos, P23)', async () => {
    const h = buildHarness();
    await h.createEntry.execute(rawEntry({ category: 'Alimentação' }));
    const view = await h.createEntry.execute(rawEntry({ category: '  alimentação ' }));
    expect(view.category).toBe('Alimentação');
    const income = await h.createEntry.execute(rawEntry({ type: 'INCOME', category: 'ALIMENTAÇÃO' }));
    expect(income.category).toBe('Alimentação');
  });

  it('categoria nova mantem a grafia informada (normalizada)', async () => {
    const h = buildHarness();
    const view = await h.createEntry.execute(rawEntry({ category: '  Casa   e Jardim ' }));
    expect(view.category).toBe('Casa e Jardim');
  });

  it('CA18: valor sem casas completa com zeros', async () => {
    const h = buildHarness();
    expect((await h.createEntry.execute(rawEntry({ amount: '10' }))).amount.toString()).toBe('10.00');
    expect((await h.createEntry.execute(rawEntry({ amount: '10.5' }))).amount.toString()).toBe('10.50');
  });
});

describe('CreateEntry - eventos', () => {
  it('publica EntryCreated depois do insert (nunca antes, nunca em caso de erro)', async () => {
    const h = buildHarness();
    let insertsWhenPublished = -1;
    const original = h.publisher.publish.bind(h.publisher);
    h.publisher.publish = async (events) => {
      insertsWhenPublished = h.entries.calls.insert;
      return original(events);
    };
    await h.createEntry.execute(rawEntry());
    expect(insertsWhenPublished).toBe(1);
    expect(h.publisher.names()).toEqual(['EntryCreated']);
  });

  it('erro de validacao nao publica nada', async () => {
    const h = buildHarness();
    await rejected(h.createEntry.execute(rawEntry({ description: '' })));
    expect(h.publisher.published).toEqual([]);
  });
});
