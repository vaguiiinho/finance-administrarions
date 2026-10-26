import { buildHarness } from '@test/support/finance-harness.js';
import { NOW, cardUuid, newCard, rejected, rawEntry } from '@test/support/builders.js';
import { ListCards } from './list-cards.js';
import { InMemoryCardReadModel } from '@test/fakes/in-memory-read-models.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LATER = new Date('2026-10-06T09:30:00.000Z');

describe('CreateCard', () => {
  it('CA01: cria com id do gerador (UUID v7), tempos do clock e publica CardCreated', async () => {
    const h = buildHarness();
    const view = await h.createCard.execute({ name: 'Nubank', closingDay: 25, dueDay: 5 });
    expect(view.id).toMatch(UUID_V7);
    expect(view).toMatchObject({ name: 'Nubank', closingDay: 25, dueDay: 5, createdAt: NOW, updatedAt: NOW });
    expect(h.cards.store.size).toBe(1);
    expect(h.publisher.names()).toEqual(['CardCreated']);
  });

  it('CA02: payload invalido -> 400 com details por campo e nada gravado', async () => {
    const h = buildHarness();
    const error = await rejected(h.createCard.execute({ name: '', closingDay: 0, dueDay: 32 }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(error.details.fields.map((f: { field: string }) => f.field).sort()).toEqual(['closingDay', 'dueDay', 'name']);
    expect(h.cards.calls.insert).toBe(0);
    expect(h.publisher.published).toEqual([]);
  });

  it('CA03: " nubank " duplica "Nubank" -> 409 CARD_NAME_TAKEN em name, nada inserido nem publicado', async () => {
    const h = buildHarness();
    await h.createCard.execute({ name: 'Nubank', closingDay: 25, dueDay: 5 });
    h.publisher.published.length = 0;
    const error = await rejected(h.createCard.execute({ name: ' nubank ', closingDay: 1, dueDay: 2 }));
    expect(error).toMatchObject({ code: 'CARD_NAME_TAKEN', kind: 'conflict' });
    expect(error.details.fields[0]).toMatchObject({ field: 'name', code: 'NAME_TAKEN' });
    expect(h.cards.store.size).toBe(1);
    expect(h.publisher.published).toEqual([]);
  });

  it('precedencia: validacao (400) vence conflito (409)', async () => {
    const h = buildHarness();
    await h.createCard.execute({ name: 'Nubank', closingDay: 25, dueDay: 5 });
    const error = await rejected(h.createCard.execute({ name: 'Nubank', closingDay: 99, dueDay: 5 }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('UpdateCard', () => {
  it('atualiza, publica CardUpdated e devolve a view com updatedAt do clock', async () => {
    const h = buildHarness();
    const created = await h.createCard.execute({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    h.publisher.published.length = 0;
    h.clock.set(LATER);
    const view = await h.updateCard.execute({ id: created.id, name: 'Nubank', closingDay: 20, dueDay: 25 });
    expect(view).toMatchObject({ id: created.id, closingDay: 20, dueDay: 25, updatedAt: LATER, createdAt: NOW });
    expect(h.publisher.names()).toEqual(['CardUpdated']);
  });

  it('sem mudanca efetiva: nao publica nem grava', async () => {
    const h = buildHarness();
    const created = await h.createCard.execute({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    h.publisher.published.length = 0;
    const updatesBefore = h.cards.calls.update;
    h.clock.set(LATER);
    const view = await h.updateCard.execute({ id: created.id, name: 'Nubank', closingDay: 10, dueDay: 17 });
    expect(view.updatedAt).toEqual(NOW);
    expect(h.publisher.published).toEqual([]);
    expect(h.cards.calls.update).toBe(updatesBefore);
  });

  it('CA06: cartao inexistente -> 404 CARD_NOT_FOUND com details.id', async () => {
    const h = buildHarness();
    const id = cardUuid(99);
    const error = await rejected(h.updateCard.execute({ id, name: 'X', closingDay: 1, dueDay: 2 }));
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(error.details).toEqual({ id });
  });

  it('id mal formado -> 400', async () => {
    const h = buildHarness();
    const error = await rejected(h.updateCard.execute({ id: 'abc', name: 'X', closingDay: 1, dueDay: 2 }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
  });

  it('409 quando o nome pertence a OUTRO cartao', async () => {
    const h = buildHarness();
    await h.createCard.execute({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    const itau = await h.createCard.execute({ name: 'Itau', closingDay: 10, dueDay: 17 });
    const error = await rejected(h.updateCard.execute({ id: itau.id, name: 'NUBANK', closingDay: 10, dueDay: 17 }));
    expect(error).toMatchObject({ code: 'CARD_NAME_TAKEN', kind: 'conflict' });
  });

  it('renomear a caixa do proprio cartao e permitido', async () => {
    const h = buildHarness();
    const created = await h.createCard.execute({ name: 'nubank', closingDay: 10, dueDay: 17 });
    const view = await h.updateCard.execute({ id: created.id, name: 'Nubank', closingDay: 10, dueDay: 17 });
    expect(view.name).toBe('Nubank');
  });

  it('precedencia: 404 vence 409 (cartao inexistente com nome duplicado)', async () => {
    const h = buildHarness();
    await h.createCard.execute({ name: 'Nubank', closingDay: 10, dueDay: 17 });
    const error = await rejected(h.updateCard.execute({ id: cardUuid(99), name: 'Nubank', closingDay: 10, dueDay: 17 }));
    expect(error.code).toBe('CARD_NOT_FOUND');
  });

  it('precedencia: 400 vence 404', async () => {
    const h = buildHarness();
    const error = await rejected(h.updateCard.execute({ id: cardUuid(99), name: '', closingDay: 10, dueDay: 17 }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('CA05: editar o cartao nao altera lancamentos existentes; novo usa os dias novos', async () => {
    const h = buildHarness();
    const card = await h.createCard.execute({ name: 'C', closingDay: 10, dueDay: 17 });
    const first = await h.createEntry.execute(
      rawEntry({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-15', amount: '100.00' }),
    );
    await h.updateCard.execute({ id: card.id, name: 'C', closingDay: 20, dueDay: 25 });
    const second = await h.createEntry.execute(
      rawEntry({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-15', amount: '100.00' }),
    );
    const stored = h.entries.all().find((e) => e.id.value === first.id)!;
    expect(stored.referenceMonth.toString()).toBe('2026-11');
    expect(stored.invoiceDates?.dueDate.toString()).toBe('2026-11-17');
    expect(first.referenceMonth.toString()).toBe('2026-11');
    expect(second.referenceMonth.toString()).toBe('2026-10');
    expect(second.invoice?.closingDate.toString()).toBe('2026-10-20');
    expect(second.invoice?.dueDate.toString()).toBe('2026-10-25');
  });
});

describe('ListCards', () => {
  it('devolve { items } do read model (ordem do read model)', async () => {
    const h = buildHarness();
    h.cards.seed(newCard(1, { name: 'Nubank' }));
    h.cards.seed(newCard(2, { name: 'Itau' }));
    const result = await new ListCards(new InMemoryCardReadModel(h.cards)).execute({});
    expect(result.items.map((c: { name: string }) => c.name)).toEqual(['Itau', 'Nubank']);
    expect(result.items[0]).toMatchObject({ closingDay: 25, dueDay: 5 });
  });
});
