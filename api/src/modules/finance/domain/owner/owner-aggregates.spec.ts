import { InvariantViolationError } from '@shared/domain/app-error.js';
import { Card } from '../card/card.js';
import { Entry } from '../entry/entry.js';
import { ana, bruno, ownedCard, ownedCardExpense, ownedEntry, ownedIncome, ownerOf, ANA, BRUNO } from '@test/support/owned-builders.js';
import { NOW, pullEvents, thrown } from '@test/support/builders.js';

describe('Card com dono (RF23, RF26)', () => {
  it('create guarda o dono e o expoe em ownerId e no snapshot', () => {
    const card = ownedCard(ana, 1, { name: 'Nubank' });
    expect(ownerOf(card as never)).toBe(ANA);
    expect(String((card.toSnapshot() as { ownerId?: unknown }).ownerId)).toBe(ANA);
  });

  it('restore preserva o dono; update nunca o altera', () => {
    const card = ownedCard(bruno, 1, { name: 'Nubank', closingDay: 10, dueDay: 17 });
    const restored = Card.restore(card.toSnapshot());
    expect(ownerOf(restored as never)).toBe(BRUNO);
    restored.update({ name: 'Nubank Plus', closingDay: 20, dueDay: 25 }, new Date(NOW.getTime() + 1000));
    expect(ownerOf(restored as never)).toBe(BRUNO);
  });

  it('billingInfo carrega o dono do cartao (defesa em profundidade do Entry)', () => {
    expect(String((ownedCard(ana, 1).billingInfo() as { ownerId?: unknown }).ownerId)).toBe(ANA);
  });

  it('CardCreated leva ownerId no payload (nao sai em HTTP)', () => {
    const [event] = pullEvents(ownedCard(ana, 1)) as { ownerId?: unknown }[];
    expect(String(event.ownerId)).toBe(ANA);
  });
});

describe('Entry com dono (RF23)', () => {
  it('despesa PIX, receita e despesa no cartao guardam o dono informado', () => {
    const card = ownedCard(ana, 1);
    expect(ownerOf(ownedEntry(ana, 1) as never)).toBe(ANA);
    expect(ownerOf(ownedIncome(bruno, 2) as never)).toBe(BRUNO);
    expect(ownerOf(ownedCardExpense(ana, 3, card) as never)).toBe(ANA);
  });

  it('snapshot e restore preservam o dono', () => {
    const entry = ownedEntry(bruno, 1);
    expect(String((entry.toSnapshot() as { ownerId?: unknown }).ownerId)).toBe(BRUNO);
    expect(ownerOf(Entry.restore(entry.toSnapshot()) as never)).toBe(BRUNO);
  });

  it('cartao de OUTRO dono -> InvariantViolationError (o use case ja devolveu 404; isto e a ultima barreira)', () => {
    const anasCard = ownedCard(ana, 1);
    const error = thrown(() => ownedCardExpense(bruno, 1, anasCard));
    expect(error).toBeInstanceOf(InvariantViolationError);
  });

  it('EntryCreated leva ownerId no payload', () => {
    const [event] = pullEvents(ownedEntry(ana, 1)) as { ownerId?: unknown }[];
    expect(String(event.ownerId)).toBe(ANA);
  });
});
