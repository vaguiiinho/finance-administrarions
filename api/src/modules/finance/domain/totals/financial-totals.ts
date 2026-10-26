import { Money } from '@shared/domain/value-objects/money.js';
import { ExpenseTotals } from './expense-totals.js';

/** Fórmula única dos saldos: realizado = receitas - pagas; previsto = receitas - total de despesas. */
export class FinancialTotals {
  static readonly ZERO = new FinancialTotals(Money.ZERO, ExpenseTotals.ZERO);

  private constructor(
    readonly income: Money,
    readonly expenses: ExpenseTotals,
  ) {}

  static of(p: { income: Money; expenses: ExpenseTotals }): FinancialTotals {
    return new FinancialTotals(p.income, p.expenses);
  }

  get realizedBalance(): Money {
    return this.income.subtract(this.expenses.paid);
  }

  get projectedBalance(): Money {
    return this.income.subtract(this.expenses.total);
  }
}
