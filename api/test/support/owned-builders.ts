import { unwrap } from './result.js';
import { NOW, cardId, entryId, rawEntry } from './builders.js';
import { Card } from '@finance/domain/card/card.js';
import { Entry } from '@finance/domain/entry/entry.js';
import { NewEntryInput, type RawEntryInput } from '@finance/domain/entry/new-entry-input.js';
import { OwnerId } from '@finance/domain/owner/owner-id.js';

/**
 * Builders com DONO (ADR 0005 4.2). CONTRATO ASSUMIDO: `Card.create({ ownerId, ... })`, `Entry.create({ ownerId, ... })`,
 * `card.ownerId`, `entry.ownerId`, `card.billingInfo().ownerId`. Os casts `as never` existem porque as assinaturas
 * atuais ainda nao conhecem `ownerId` (fase RED).
 */
const uuid = (n: number) => `0a000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Ana e Bruno: os dois donos de todo teste de finance. */
export const ANA = uuid(1);
export const BRUNO = uuid(2);
export const owner = (raw: string): OwnerId => unwrap<OwnerId>(OwnerId.create(raw));
export const ana = owner(ANA);
export const bruno = owner(BRUNO);

export function ownedCard(
  who: OwnerId,
  n: number,
  props: { name?: string; closingDay?: number; dueDay?: number } = {},
  now: Date = NOW,
): Card {
  return Card.create({
    ownerId: who,
    id: cardId(n),
    name: props.name ?? `Cartao ${n}`,
    closingDay: props.closingDay ?? 25,
    dueDay: props.dueDay ?? 5,
    now,
  } as never);
}

export function ownedEntry(
  who: OwnerId,
  n: number,
  overrides: Partial<RawEntryInput> = {},
  card: Card | null = null,
  now: Date = NOW,
): Entry {
  return Entry.create({
    ownerId: who,
    id: entryId(n),
    input: NewEntryInput.parse(rawEntry(overrides)),
    card: card ? card.billingInfo() : null,
    now,
  } as never);
}

export const ownedPixExpense = ownedEntry;

export function ownedIncome(who: OwnerId, n: number, overrides: Partial<RawEntryInput> = {}, now: Date = NOW): Entry {
  return ownedEntry(
    who,
    n,
    { type: 'INCOME', description: 'Salario', category: 'Salario', amount: '5000.00', ...overrides },
    null,
    now,
  );
}

export function ownedCardExpense(
  who: OwnerId,
  n: number,
  card: Card,
  overrides: Partial<RawEntryInput> = {},
  now: Date = NOW,
): Entry {
  return ownedEntry(
    who,
    n,
    { paymentMethod: 'CARD', cardId: card.id.value, date: '2026-10-10', amount: '100.00', ...overrides },
    card,
    now,
  );
}

/** Dono lido do aggregate, normalizado para string (aceita OwnerId ou string). */
export const ownerOf = (aggregate: { ownerId?: unknown }): string | undefined =>
  aggregate.ownerId === undefined ? undefined : String(aggregate.ownerId);
