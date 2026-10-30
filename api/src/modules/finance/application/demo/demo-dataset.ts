import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { Card } from '../../domain/card/card.js';
import { CardId } from '../../domain/card/value-objects/card-id.js';
import { Entry } from '../../domain/entry/entry.js';
import { NewEntryInput, type RawEntryInput } from '../../domain/entry/new-entry-input.js';
import { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';

/** Incrementar quando o conteúdo do modelo mudar (a Feature B regenera a demo com categorias-entidade). */
export const DEMO_TEMPLATE_VERSION = 1;

/** Meses de histórico até a âncora, inclusive (ADR 0005 5.6). */
const HISTORY_MONTHS = 12;

interface DatasetContext {
  ownerId: OwnerId;
  anchor: YearMonth;
  ids: IdGenerator;
  now: Date;
}

const take = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }, what: string): T => {
  if (!result.ok) throw new InvariantViolationError(`IdGenerator devolveu um ${what} inválido.`);
  return result.value;
};

/**
 * Modelo puro e determinístico dos dados de exemplo: só as datas acompanham a âncora; valores e descrições são fixos.
 * Cobre os 12 meses que terminam na âncora e a fatura do mês seguinte (nada fora dessa janela).
 */
export function buildDemoDataset(ctx: DatasetContext): { cards: Card[]; entries: Entry[] } {
  const { ownerId, anchor, ids, now } = ctx;
  const newCard = (name: string, closingDay: number, dueDay: number): Card =>
    Card.create({ ownerId, id: take(CardId.create(ids.next()), 'id de cartão'), name, closingDay, dueDay, now });

  // Fecha dia 10, vence dia 17: compra de um mês cai na fatura do mesmo mês.
  const blue = newCard('Cartão Azul', 10, 17);
  // Fecha dia 25, vence dia 5: compra de um mês cai na fatura do mês seguinte.
  const purple = newCard('Cartão Roxo', 25, 5);

  const entries: Entry[] = [];
  const add = (month: YearMonth, day: number, raw: Partial<RawEntryInput>, card: Card | null = null): void => {
    const input = NewEntryInput.parse({
      type: 'EXPENSE',
      description: '',
      category: '',
      date: `${month.toString()}-${String(day).padStart(2, '0')}`,
      amount: '0.00',
      paymentMethod: 'PIX',
      cardId: card ? card.id.value : null,
      paid: undefined,
      ...raw,
    });
    const entry = Entry.create({
      id: take(EntryId.create(ids.next()), 'id de lançamento'),
      ownerId,
      input,
      card: card ? card.billingInfo() : null,
      now,
    });
    // Faturas de meses anteriores ao da âncora já foram pagas.
    if (card && entry.referenceMonth.toString() < anchor.toString()) entry.markAsPaid(now);
    entries.push(entry);
  };

  for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
    const month = anchor.minusMonths(i);
    const current = i === 0;
    add(month, 5, { type: 'INCOME', description: 'Salário', category: 'Salário', amount: '6500.00' });
    add(month, 6, { description: 'Aluguel', category: 'Moradia', amount: '1800.00' });
    add(month, 12, { description: 'Combustível', category: 'Transporte', amount: '250.00' });
    add(month, 20, { description: 'Internet e telefone', category: 'Contas', amount: '179.90', paid: !current });
    add(month, 4, { description: 'Supermercado', category: 'Mercado', amount: '430.00', paymentMethod: 'CARD' }, blue);
    add(month, 8, { description: 'Farmácia', category: 'Saúde', amount: '76.50', paymentMethod: 'CARD' }, blue);
    add(month, 12, { description: 'Streaming e lazer', category: 'Lazer', amount: '89.90', paymentMethod: 'CARD' }, purple);
  }
  return { cards: [blue, purple], entries };
}
