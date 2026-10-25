import type { Card } from '../../domain/card/card.js';
import type { Entry } from '../../domain/entry/entry.js';
import type { CardView } from '../ports/card-read-model.js';
import type { EntryView } from '../ports/views.js';

export function toCardView(card: Card): CardView {
  const s = card.toSnapshot();
  return {
    id: s.id.value,
    name: s.name.value,
    closingDay: s.closingDay.value,
    dueDay: s.dueDay.value,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function toEntryView(entry: Entry, card: { id: string; name: string } | null): EntryView {
  const s = entry.toSnapshot();
  return {
    id: s.id.value,
    type: s.type,
    description: s.description.value,
    category: s.category.value,
    date: s.date,
    amount: s.amount,
    paymentMethod: s.paymentMethod,
    card,
    invoice: s.invoiceDates
      ? { closingDate: s.invoiceDates.closingDate, dueDate: s.invoiceDates.dueDate }
      : null,
    referenceMonth: s.referenceMonth,
    status: s.status,
    paidAt: s.paidAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
