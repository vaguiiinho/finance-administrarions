import { Money } from '@shared/domain/value-objects/money.js';
import { InstallmentPlan } from './installment-plan.js';

describe('InstallmentPlan', () => {
  it('distributes remainder cents to first installments and sums to total exactly', () => {
    const plan = InstallmentPlan.create('2026-11-15', '350.00', 6);

    expect(plan.items.map((item) => item.amount.toString())).toEqual([
      '58.34',
      '58.34',
      '58.33',
      '58.33',
      '58.33',
      '58.33',
    ]);
    expect(Money.sum(plan.items.map((item) => item.amount)).toString()).toBe('350.00');
  });

  it('clamps short months without shifting the original day for subsequent months', () => {
    const plan = InstallmentPlan.create('2026-01-31', '4.00', 4);

    expect(plan.items.map((item) => item.date.toString())).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('uses the leap day for February when applicable', () => {
    const plan = InstallmentPlan.create('2028-01-31', '2.00', 2);

    expect(plan.items[1].date.toString()).toBe('2028-02-29');
  });

  it.each([1, 37, 2.5])('rejects invalid installment count %s', (count) => {
    expect(() => InstallmentPlan.create('2026-11-15', '350.00', count)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('rejects a total that cannot provide at least one cent for every installment', () => {
    expect(() => InstallmentPlan.create('2026-11-15', '0.02', 3)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});
