import { InvariantViolationError } from '@shared/domain/app-error.js';
import { Money } from '@shared/domain/value-objects/money.js';

export class ExpenseTotals {
  static readonly ZERO = new ExpenseTotals(Money.ZERO, Money.ZERO);

  private constructor(
    readonly paid: Money,
    readonly pending: Money,
  ) {}

  /** Lança InvariantViolationError se algum componente for negativo. */
  static of(p: { paid: Money; pending: Money }): ExpenseTotals {
    if (p.paid.isNegative() || p.pending.isNegative()) {
      throw new InvariantViolationError('Totais de despesas não podem ser negativos.');
    }
    return new ExpenseTotals(p.paid, p.pending);
  }

  get total(): Money {
    return this.paid.add(this.pending);
  }
}
