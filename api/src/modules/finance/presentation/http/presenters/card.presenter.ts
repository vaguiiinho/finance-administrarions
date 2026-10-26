import type { CardView } from '../../../application/ports/card-read-model.js';

export function presentCard(view: CardView) {
  return {
    id: view.id,
    name: view.name,
    closingDay: view.closingDay,
    dueDay: view.dueDay,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
