import fc from 'fast-check';
import { money, thrown } from '@test/support/builders.js';
import { Money } from '@shared/domain/value-objects/money.js';
import { ExpenseTotals } from './expense-totals.js';
import { FinancialTotals } from './financial-totals.js';

const totals = (income: string, paid: string, pending: string) =>
  FinancialTotals.of({ income: money(income), expenses: ExpenseTotals.of({ paid: money(paid), pending: money(pending) }) });

describe('ExpenseTotals', () => {
  it('total = paid + pending', () => {
    const t = ExpenseTotals.of({ paid: money('40.00'), pending: money('100.00') });
    expect(t.total.toString()).toBe('140.00');
    expect(t.paid.toString()).toBe('40.00');
    expect(t.pending.toString()).toBe('100.00');
  });

  it('ZERO', () => {
    expect(ExpenseTotals.ZERO.total.toString()).toBe('0.00');
  });

  it('componente negativo -> InvariantViolationError', () => {
    expect(thrown(() => ExpenseTotals.of({ paid: money('-0.01'), pending: money('1') })).constructor.name).toBe(
      'InvariantViolationError',
    );
    expect(thrown(() => ExpenseTotals.of({ paid: money('1'), pending: money('-5') })).constructor.name).toBe(
      'InvariantViolationError',
    );
  });

  it('CA52: 0.10 + 0.20 + 0.30 e exato', () => {
    expect(ExpenseTotals.of({ paid: money('0.10'), pending: money('0.50') }).total.toString()).toBe('0.60');
  });
});

describe('FinancialTotals (CA48, CA51, CA52, CA59, CA60, CA65)', () => {
  it('CA48: receitas 5000, pagas 3000, pendentes 2500', () => {
    const t = totals('5000.00', '3000.00', '2500.00');
    expect(t.income.toString()).toBe('5000.00');
    expect(t.expenses.total.toString()).toBe('5500.00');
    expect(t.expenses.paid.toString()).toBe('3000.00');
    expect(t.expenses.pending.toString()).toBe('2500.00');
    expect(t.realizedBalance.toString()).toBe('2000.00');
    expect(t.projectedBalance.toString()).toBe('-500.00');
  });

  it('CA59: saldos positivos', () => {
    const t = totals('5000.00', '800.00', '200.00');
    expect(t.expenses.total.toString()).toBe('1000.00');
    expect(t.realizedBalance.toString()).toBe('4200.00');
    expect(t.projectedBalance.toString()).toBe('4000.00');
  });

  it('CA60: saldo previsto negativo, realizado positivo', () => {
    const t = totals('1000.00', '0.00', '1500.00');
    expect(t.realizedBalance.toString()).toBe('1000.00');
    expect(t.projectedBalance.toString()).toBe('-500.00');
    expect(t.projectedBalance.isNegative()).toBe(true);
  });

  it('CA51: pagar A (100.10) e B (49.90) move pendente para pago sem alterar o previsto', () => {
    const before = totals('1000.00', '200.00', '300.00');
    const after = totals('1000.00', '350.00', '150.00');
    expect(after.expenses.pending.toString()).toBe('150.00');
    expect(after.expenses.paid.toString()).toBe('350.00');
    expect(after.expenses.total.toString()).toBe('500.00');
    expect(after.realizedBalance.toString()).toBe('650.00');
    expect(after.projectedBalance.toString()).toBe('500.00');
    expect(after.projectedBalance.equals(before.projectedBalance)).toBe(true);
  });

  it('CA52: despesas 0.10/0.20/0.30 e receita 0.50 -> total 0.60 e previsto -0.10', () => {
    const t = totals('0.50', '0.00', '0.60');
    expect(t.expenses.total.toString()).toBe('0.60');
    expect(t.projectedBalance.toString()).toBe('-0.10');
  });

  it('CA65: ZERO e tudo zerado, sem "-0.00"', () => {
    for (const t of [FinancialTotals.ZERO, totals('0', '0', '0')]) {
      expect(t.income.toString()).toBe('0.00');
      expect(t.expenses.total.toString()).toBe('0.00');
      expect(t.realizedBalance.toString()).toBe('0.00');
      expect(t.projectedBalance.toString()).toBe('0.00');
    }
  });

  it('CA49 (propriedade): total = paid + pending; realizado = receita - pagas; previsto = receita - total; previsto <= realizado', () => {
    const cents = fc.bigInt({ min: 0n, max: 10n ** 14n });
    fc.assert(
      fc.property(cents, cents, cents, (i, p, q) => {
        const t = FinancialTotals.of({
          income: Money.fromCents(i),
          expenses: ExpenseTotals.of({ paid: Money.fromCents(p), pending: Money.fromCents(q) }),
        });
        expect(t.expenses.total.toCents()).toBe(p + q);
        expect(t.realizedBalance.toCents()).toBe(i - p);
        expect(t.projectedBalance.toCents()).toBe(i - p - q);
        expect(t.projectedBalance.compare(t.realizedBalance)).toBeLessThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});
