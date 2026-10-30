import { money, rejected, ownedUseCase } from '@test/support/builders.js';
import { unwrap } from '@test/support/result.js';
import { ReferenceMonth } from '@finance/domain/billing/reference-month.js';
import { ListCategories } from '../entries/list-categories.js';
import { GetCategoryDistribution } from './get-category-distribution.js';
import { GetMonthlySeries } from './get-monthly-series.js';

const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));
const zeros = { income: money('0'), paidExpenses: money('0'), pendingExpenses: money('0') };
const twelveMonths = Array.from({ length: 12 }, (_, i) => {
  const idx = 2025 * 12 + 10 + i; // 2025-11 .. 2026-10
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
});

describe('GetMonthlySeries', () => {
  const build = (months = twelveMonths, totals: Record<string, any> = {}) => ({
    monthlySeries: vi.fn(async (_owner: unknown, _from: unknown, _to: unknown) =>
      months.map((m) => ({ month: rm(m), totals: totals[m] ?? zeros })),
    ),
    expenseDistribution: vi.fn(),
  });

  it('CA62: pede 2025-11..2026-10 e devolve 12 pontos com zeros', async () => {
    const dashboard = build();
    const result = await ownedUseCase(GetMonthlySeries, dashboard as never).execute({ month: '2026-10' });
    expect(String(dashboard.monthlySeries.mock.calls[0][1])).toBe('2025-11');
    expect(String(dashboard.monthlySeries.mock.calls[0][2])).toBe('2026-10');
    expect(result.from.toString()).toBe('2025-11');
    expect(result.to.toString()).toBe('2026-10');
    expect(result.points).toHaveLength(12);
    expect(result.points[0].month.toString()).toBe('2025-11');
    expect(result.points[11].month.toString()).toBe('2026-10');
    expect(result.points[0].totals.realizedBalance.toString()).toBe('0.00');
  });

  it('cada ponto vira FinancialTotals com saldos', async () => {
    const dashboard = build(twelveMonths, {
      '2026-10': { income: money('1000.00'), paidExpenses: money('0'), pendingExpenses: money('1500.00') },
    });
    const result = await ownedUseCase(GetMonthlySeries, dashboard as never).execute({ month: '2026-10' });
    const last = result.points[11].totals;
    expect(last.realizedBalance.toString()).toBe('1000.00');
    expect(last.projectedBalance.toString()).toBe('-500.00');
  });

  it('afirma 12 pontos: read model devolvendo 11 e erro (invariante)', async () => {
    await expect(ownedUseCase(GetMonthlySeries, build(twelveMonths.slice(1)) as never).execute({ month: '2026-10' })).rejects.toThrow();
  });

  it('mes invalido/ausente -> 400', async () => {
    for (const month of [undefined, '2026-13']) {
      const error = await rejected(ownedUseCase(GetMonthlySeries, build() as never).execute({ month } as never));
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });
});

describe('GetCategoryDistribution', () => {
  const dashboard = (items: { category: string; total: string; percentage: string }[]) => ({
    monthlySeries: vi.fn(),
    expenseDistribution: vi.fn(async (_owner: unknown, _m: unknown) => items.map((i) => ({ ...i, total: money(i.total) }))),
  });

  it('CA64: itens do read model e total = soma', async () => {
    const dash = dashboard([
      { category: 'Moradia', total: '1500.00', percentage: '75.00' },
      { category: 'Alimentação', total: '500.00', percentage: '25.00' },
    ]);
    const result = await ownedUseCase(GetCategoryDistribution, dash as never).execute({ month: '2026-10' });
    expect(String(dash.expenseDistribution.mock.calls[0][1])).toBe('2026-10');
    expect(result.month.toString()).toBe('2026-10');
    expect(result.total.toString()).toBe('2000.00');
    expect(result.items.map((i: any) => [i.category, i.total.toString(), i.percentage])).toEqual([
      ['Moradia', '1500.00', '75.00'],
      ['Alimentação', '500.00', '25.00'],
    ]);
  });

  it('CA65: mes sem despesas -> total "0.00" e itens vazios', async () => {
    const result = await ownedUseCase(GetCategoryDistribution, dashboard([]) as never).execute({ month: '2026-10' });
    expect(result.total.toString()).toBe('0.00');
    expect(result.items).toEqual([]);
  });

  it('mes invalido -> 400', async () => {
    const error = await rejected(ownedUseCase(GetCategoryDistribution, dashboard([]) as never).execute({ month: 'x' }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('ListCategories', () => {
  it('devolve { items } do read model', async () => {
    const result = await ownedUseCase(ListCategories, { listDistinct: async () => ['Alimentação', 'Moradia'] }).execute({});
    expect(result).toEqual({ items: ['Alimentação', 'Moradia'] });
  });
});
