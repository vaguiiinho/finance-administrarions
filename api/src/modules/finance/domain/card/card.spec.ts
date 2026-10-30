import { DEFAULT_OWNER, NOW, cardId, eventNames, newCard, pullEvents, thrown } from '@test/support/builders.js';
import { Card } from './card.js';

const LATER = new Date('2026-10-06T09:30:00.000Z');
type Violation = { field: string; code: string };
const fieldsOf = (fn: () => unknown) => {
  const error = thrown(fn);
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.kind).toBe('validation');
  return error.details.fields as Violation[];
};

describe('Card.create (CA01, CA02)', () => {
  it('CA01: cria com nome normalizado, dias e timestamps; emite CardCreated', () => {
    const card = Card.create({ ownerId: DEFAULT_OWNER, id: cardId(1), name: '  Nubank ', closingDay: 25, dueDay: 5, now: NOW });
    expect(card.name.value).toBe('Nubank');
    expect(card.closingDay.value).toBe(25);
    expect(card.dueDay.value).toBe(5);
    expect(card.toSnapshot().createdAt).toEqual(NOW);
    expect(card.toSnapshot().updatedAt).toEqual(NOW);
    const events = pullEvents(card);
    expect(eventNames(events)).toEqual(['CardCreated']);
    expect(events[0]).toMatchObject({ occurredAt: NOW });
  });

  it('vencimento pode ser menor, igual ou maior que o fechamento', () => {
    for (const [c, v] of [[25, 5], [10, 10], [3, 10]]) {
      expect(() => newCard(1, { closingDay: c, dueDay: v })).not.toThrow();
    }
  });

  it.each([[0], [32], [-3]])('CA02: dia %i -> OUT_OF_RANGE nos dois campos', (day) => {
    const list = fieldsOf(() => Card.create({ ownerId: DEFAULT_OWNER, id: cardId(1), name: 'X', closingDay: day, dueDay: day, now: NOW }));
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'closingDay', code: 'OUT_OF_RANGE' }),
        expect.objectContaining({ field: 'dueDay', code: 'OUT_OF_RANGE' }),
      ]),
    );
  });

  it('CA02: 10.5 -> NOT_INTEGER', () => {
    const list = fieldsOf(() => Card.create({ ownerId: DEFAULT_OWNER, id: cardId(1), name: 'X', closingDay: 10.5, dueDay: 5, now: NOW }));
    expect(list).toContainEqual(expect.objectContaining({ field: 'closingDay', code: 'NOT_INTEGER' }));
  });

  it('CA02: nome vazio -> REQUIRED, 51 caracteres -> TOO_LONG', () => {
    expect(fieldsOf(() => newCard(1, { name: '' }))).toContainEqual(expect.objectContaining({ field: 'name', code: 'REQUIRED' }));
    expect(fieldsOf(() => newCard(1, { name: 'a'.repeat(51) }))).toContainEqual(
      expect.objectContaining({ field: 'name', code: 'TOO_LONG' }),
    );
  });

  it('CA02: acumula TODAS as violacoes', () => {
    const list = fieldsOf(() => Card.create({ ownerId: DEFAULT_OWNER, id: cardId(1), name: '', closingDay: 0, dueDay: 32, now: NOW }));
    expect(new Set(list.map((v) => v.field))).toEqual(new Set(['name', 'closingDay', 'dueDay']));
  });
});

describe('Card.update', () => {
  it('com mudanca: substitui os tres campos, atualiza updatedAt, emite CardUpdated com before/after e retorna true', () => {
    const card = newCard(1, { name: 'Nubank', closingDay: 10, dueDay: 17 });
    pullEvents(card);
    expect(card.update({ name: 'Nubank Ultravioleta', closingDay: 20, dueDay: 25 }, LATER)).toBe(true);
    expect(card.name.value).toBe('Nubank Ultravioleta');
    expect(card.closingDay.value).toBe(20);
    expect(card.dueDay.value).toBe(25);
    expect(card.toSnapshot().updatedAt).toEqual(LATER);
    expect(card.toSnapshot().createdAt).toEqual(NOW);
    const events = pullEvents(card);
    expect(eventNames(events)).toEqual(['CardUpdated']);
    expect(JSON.stringify(events[0], (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).toContain('Nubank');
  });

  it('sem mudanca efetiva: no-op (false), sem updatedAt nem evento', () => {
    const card = newCard(1, { name: 'Nubank', closingDay: 10, dueDay: 17 });
    pullEvents(card);
    expect(card.update({ name: 'Nubank', closingDay: 10, dueDay: 17 }, LATER)).toBe(false);
    expect(card.toSnapshot().updatedAt).toEqual(NOW);
    expect(pullEvents(card)).toEqual([]);
  });

  it('mudar so a caixa/espacos do nome conta como mudanca de grafia (renomear a caixa e permitido)', () => {
    const card = newCard(1, { name: 'nubank' });
    expect(card.update({ name: 'Nubank', closingDay: 25, dueDay: 5 }, LATER)).toBe(true);
    expect(card.name.value).toBe('Nubank');
  });

  it('props invalidas lancam CardValidationError e nao alteram o cartao', () => {
    const card = newCard(1, { name: 'Nubank', closingDay: 10, dueDay: 17 });
    const list = fieldsOf(() => card.update({ name: '', closingDay: 40, dueDay: 17 }, LATER));
    expect(list.map((v) => v.field)).toEqual(expect.arrayContaining(['name', 'closingDay']));
    expect(card.name.value).toBe('Nubank');
    expect(card.closingDay.value).toBe(10);
  });
});

describe('Card.billingInfo / restore', () => {
  it('billingInfo traz cardId, closingDay e dueDay (snapshot para o Entry)', () => {
    const card = newCard(4, { closingDay: 25, dueDay: 5 });
    const info = card.billingInfo();
    expect(info.cardId.value).toBe(card.id.value);
    expect(info.closingDay.value).toBe(25);
    expect(info.dueDay.value).toBe(5);
  });

  it('o snapshot de billingInfo nao muda quando o cartao e editado depois', () => {
    const card = newCard(4, { closingDay: 25, dueDay: 5 });
    const info = card.billingInfo();
    card.update({ name: card.name.value, closingDay: 1, dueDay: 2 }, LATER);
    expect(info.closingDay.value).toBe(25);
    expect(info.dueDay.value).toBe(5);
  });

  it('restore faz round trip do snapshot sem emitir eventos', () => {
    const card = newCard(1);
    const restored = Card.restore(card.toSnapshot());
    expect(restored.toSnapshot()).toEqual(card.toSnapshot());
    expect(pullEvents(restored)).toEqual([]);
  });

  it('restore rejeita updatedAt < createdAt', () => {
    const snap = { ...newCard(1).toSnapshot(), updatedAt: new Date(NOW.getTime() - 1) };
    expect(thrown(() => Card.restore(snap)).constructor.name).toBe('InvariantViolationError');
  });
});
