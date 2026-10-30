import { DEFAULT_OWNER_ID_VALUE, money, rejected, ownedUseCase } from '@test/support/builders.js';
import { GetMonthlySummary } from './get-monthly-summary.js';

const readModel = (row = { income: '5000.00', paidExpenses: '3000.00', pendingExpenses: '2500.00' }) => ({
  summary: vi.fn(async () => ({
    income: money(row.income),
    paidExpenses: money(row.paidExpenses),
    pendingExpenses: money(row.pendingExpenses),
  })),
});

describe('GetMonthlySummary', () => {
  it('CA48: converte somatorios em FinancialTotals', async () => {
    const result = await ownedUseCase(GetMonthlySummary, readModel()).execute({ month: '2026-10' });
    expect(result.month.toString()).toBe('2026-10');
    expect(result.totals.income.toString()).toBe('5000.00');
    expect(result.totals.expenses.total.toString()).toBe('5500.00');
    expect(result.totals.expenses.paid.toString()).toBe('3000.00');
    expect(result.totals.expenses.pending.toString()).toBe('2500.00');
    expect(result.totals.realizedBalance.toString()).toBe('2000.00');
    expect(result.totals.projectedBalance.toString()).toBe('-500.00');
  });

  it('CA65: mes sem dados -> zeros', async () => {
    const rm = readModel({ income: '0.00', paidExpenses: '0.00', pendingExpenses: '0.00' });
    const result = await ownedUseCase(GetMonthlySummary, rm).execute({ month: '2026-10' });
    expect(result.totals.realizedBalance.toString()).toBe('0.00');
    expect(result.totals.projectedBalance.toString()).toBe('0.00');
  });

  it('DR6/CA47: o port recebe apenas o mes (assinatura sem filtros)', async () => {
    const rm = readModel();
    await ownedUseCase(GetMonthlySummary, rm).execute({ month: '2026-10' });
    expect(rm.summary).toHaveBeenCalledTimes(1);
    const args = rm.summary.mock.calls[0] as unknown[];
    expect(args).toHaveLength(2);
    expect(String(args[0])).toBe(DEFAULT_OWNER_ID_VALUE);
    expect(String(args[1])).toBe('2026-10');
  });

  it.each([
    [undefined, 'REQUIRED'],
    ['', 'REQUIRED'],
    ['2026-13', 'INVALID_FORMAT'],
    ['abc', 'INVALID_FORMAT'],
  ])('mes %j -> 400 VALIDATION_ERROR (%s), sem consultar o read model', async (month, code) => {
    const rm = readModel();
    const error = await rejected(ownedUseCase(GetMonthlySummary, rm).execute({ month: month as string }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'month', code }));
    expect(rm.summary).not.toHaveBeenCalled();
  });
});
