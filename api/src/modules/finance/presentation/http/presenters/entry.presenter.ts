import type { EntryView } from '../../../application/ports/views.js';

/** Um único presenter serve E1, E2, E3, E4 e I2: referenceMonth e invoice saem iguais em todos. */
export function presentEntry(view: EntryView) {
  return {
    id: view.id,
    type: view.type,
    description: view.description,
    category: view.category,
    date: view.date.toString(),
    amount: view.amount.toString(),
    paymentMethod: view.paymentMethod,
    card: view.card,
    invoice: view.invoice
      ? { closingDate: view.invoice.closingDate.toString(), dueDate: view.invoice.dueDate.toString() }
      : null,
    referenceMonth: view.referenceMonth.toString(),
    status: view.status,
    paidAt: view.paidAt?.toISOString() ?? null,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
