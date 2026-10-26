import { IncomesNotPayableError } from '../entry/errors/entry-errors.js';
import type { Entry } from '../entry/entry.js';

export interface PaymentOutcome {
  paid: Entry[];
  alreadyPaid: Entry[];
}

export class EntryPaymentService {
  /**
   * Se houver qualquer INCOME, lança IncomesNotPayableError com TODOS os ids de receita,
   * antes de alterar qualquer aggregate (DR1). Caso contrário aplica markAsPaid(at) a todos.
   */
  payAll(entries: readonly Entry[], at: Date): PaymentOutcome {
    const incomeIds = entries.filter((e) => e.isIncome()).map((e) => e.id.value);
    if (incomeIds.length > 0) throw new IncomesNotPayableError(incomeIds);

    const outcome: PaymentOutcome = { paid: [], alreadyPaid: [] };
    for (const entry of entries) {
      (entry.markAsPaid(at) ? outcome.paid : outcome.alreadyPaid).push(entry);
    }
    return outcome;
  }
}
