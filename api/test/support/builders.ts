import { unwrap } from './result.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { Money } from '@shared/domain/value-objects/money.js';
import { CardId } from '@finance/domain/card/value-objects/card-id.js';
import { EntryId } from '@finance/domain/entry/value-objects/entry-id.js';
import { Card } from '@finance/domain/card/card.js';
import { Entry } from '@finance/domain/entry/entry.js';
import { NewEntryInput, type RawEntryInput } from '@finance/domain/entry/new-entry-input.js';

/** Instante fixo usado como "agora" nos testes (2026-10-05T13:00:00Z, CA07). */
export const NOW = new Date('2026-10-05T13:00:00.000Z');

const uuid = (prefix: string, n: number) => `${prefix}-0000-7000-8000-${String(n).padStart(12, '0')}`;
export const cardUuid = (n: number) => uuid('c0000000', n);
export const entryUuid = (n: number) => uuid('e0000000', n);

export const cardId = (n: number): CardId => unwrap<CardId>(CardId.create(cardUuid(n)));
export const entryId = (n: number): EntryId => unwrap<EntryId>(EntryId.create(entryUuid(n)));
export const date = (v: string): CalendarDate => unwrap<CalendarDate>(CalendarDate.parse(v));
export const money = (v: string): Money => unwrap<Money>(Money.parse(v));

/** Payload bruto padrao: despesa PIX valida (CA07), `paid` omitido. */
export function rawEntry(overrides: Partial<RawEntryInput> = {}): RawEntryInput {
  return {
    type: 'EXPENSE',
    description: 'Aluguel',
    category: 'Moradia',
    date: '2026-10-05',
    amount: '1500.00',
    paymentMethod: 'PIX',
    cardId: null,
    paid: undefined,
    ...overrides,
  };
}

export function newCard(
  n: number,
  props: { name?: string; closingDay?: number; dueDay?: number } = {},
  now: Date = NOW,
): Card {
  return Card.create({
    id: cardId(n),
    name: props.name ?? `Cartao ${n}`,
    closingDay: props.closingDay ?? 25,
    dueDay: props.dueDay ?? 5,
    now,
  });
}

export function pixExpense(n: number, overrides: Partial<RawEntryInput> = {}, now: Date = NOW): Entry {
  return Entry.create({ id: entryId(n), input: NewEntryInput.parse(rawEntry(overrides)), card: null, now });
}

export function income(n: number, overrides: Partial<RawEntryInput> = {}, now: Date = NOW): Entry {
  return Entry.create({
    id: entryId(n),
    input: NewEntryInput.parse(
      rawEntry({ type: 'INCOME', description: 'Salario', category: 'Salario', amount: '5000.00', ...overrides }),
    ),
    card: null,
    now,
  });
}

export function cardExpense(
  n: number,
  card: Card,
  overrides: Partial<RawEntryInput> = {},
  now: Date = NOW,
): Entry {
  return Entry.create({
    id: entryId(n),
    input: NewEntryInput.parse(
      rawEntry({ paymentMethod: 'CARD', cardId: card.id.value, date: '2026-10-10', amount: '100.00', ...overrides }),
    ),
    card: card.billingInfo(),
    now,
  });
}

/** Eventos de dominio pendentes. Contrato assumido: `AggregateRoot.pullEvents()`; ajuste so aqui se diferir. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pullEvents(aggregate: any): unknown[] {
  return [...aggregate.pullEvents()];
}

export const eventNames = (events: readonly unknown[]): string[] =>
  events.map((e) => (e as object).constructor.name);

/** Executa `fn` e devolve o erro lancado (falha o teste se nao lancar). */
export function thrown(fn: () => unknown): Error & { code?: string; kind?: string; details?: any } {
  try {
    fn();
  } catch (e) {
    return e as never;
  }
  throw new Error('Esperava que lancasse um erro, mas nao lancou');
}

export async function rejected(promise: Promise<unknown>): Promise<Error & { code?: string; kind?: string; details?: any }> {
  try {
    await promise;
  } catch (e) {
    return e as never;
  }
  throw new Error('Esperava rejeicao, mas resolveu');
}
