import { money, rejected, ownedUseCase } from '@test/support/builders.js';
import { ListIncomes } from './list-incomes.js';

function readModel(totalItems = 3, total = '5000.00') {
  return {
    listIncomes: vi.fn(async (_owner: unknown, _c: unknown) => ({ items: [] as unknown[], totalItems, subtotal: money(total) })),
    listExpenses: vi.fn(),
    findById: vi.fn(),
  };
}

describe('ListIncomes', () => {
  it('padroes de paginacao e subtotal como Money', async () => {
    const rm = readModel();
    const result = await ownedUseCase(ListIncomes, rm as never).execute({ month: '2026-11' });
    const criteria = rm.listIncomes.mock.calls[0][1] as any;
    expect(String(criteria.month)).toBe('2026-11');
    expect(criteria.paging).toEqual({ page: 1, pageSize: 20 });
    expect(result.subtotal.toString()).toBe('5000.00');
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 });
    expect(result.month.toString()).toBe('2026-11');
  });

  it('CA56: categoria normalizada para chave', async () => {
    const rm = readModel();
    await ownedUseCase(ListIncomes, rm as never).execute({ month: '2026-11', category: 'SALÁRIO ' });
    expect((rm.listIncomes.mock.calls[0][1] as any).categoryKey).toBe('salário');
  });

  it('mes obrigatorio e valido; pageSize ate 100', async () => {
    const rm = readModel();
    const missing = await rejected(ownedUseCase(ListIncomes, rm as never).execute({} as never));
    expect(missing.details.fields).toContainEqual(expect.objectContaining({ field: 'month', code: 'REQUIRED' }));
    const invalid = await rejected(ownedUseCase(ListIncomes, rm as never).execute({ month: '2026-13' }));
    expect(invalid.details.fields).toContainEqual(expect.objectContaining({ field: 'month', code: 'INVALID_FORMAT' }));
    const tooBig = await rejected(ownedUseCase(ListIncomes, rm as never).execute({ month: '2026-11', pageSize: '101' }));
    expect(tooBig.code).toBe('VALIDATION_ERROR');
    expect(rm.listIncomes).not.toHaveBeenCalled();
    await expect(ownedUseCase(ListIncomes, rm as never).execute({ month: '2026-11', pageSize: '100' })).resolves.toBeDefined();
  });

  it('CA58: vazio -> subtotal 0.00', async () => {
    const result = await ownedUseCase(ListIncomes, readModel(0, '0.00') as never).execute({ month: '2026-11' });
    expect(result.subtotal.toString()).toBe('0.00');
    expect(result.pagination.totalPages).toBe(0);
  });
});
