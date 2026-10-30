import { money, rejected, ownedUseCase } from '@test/support/builders.js';
import { cardUuid } from '@test/support/builders.js';
import { ListExpenses } from './list-expenses.js';

function readModel(totalItems = 25, subtotal = { paid: '40.00', pending: '100.00' }) {
  return {
    listExpenses: vi.fn(async (_owner: unknown, _criteria: unknown) => ({
      items: [] as unknown[],
      totalItems,
      subtotal: { paid: money(subtotal.paid), pending: money(subtotal.pending) },
    })),
    listIncomes: vi.fn(),
    findById: vi.fn(),
  };
}
const criteriaOf = (rm: ReturnType<typeof readModel>) => rm.listExpenses.mock.calls[0][1] as any;

describe('ListExpenses', () => {
  it('CA46: padroes page 1 / pageSize 20 e filtro de cartao "any"', async () => {
    const rm = readModel();
    const result = await ownedUseCase(ListExpenses, rm as never).execute({ month: '2026-10' });
    const c = criteriaOf(rm);
    expect(String(c.month)).toBe('2026-10');
    expect(c.paging).toEqual({ page: 1, pageSize: 20 });
    expect(c.card).toEqual({ kind: 'any' });
    expect(c.status).toBeUndefined();
    expect(c.categoryKey).toBeUndefined();
    expect(result.month.toString()).toBe('2026-10');
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2 });
  });

  it('subtotal convertido em ExpenseTotals (total = paid + pending)', async () => {
    const result = await ownedUseCase(ListExpenses, readModel() as never).execute({ month: '2026-10' });
    expect(result.subtotal.total.toString()).toBe('140.00');
    expect(result.subtotal.paid.toString()).toBe('40.00');
    expect(result.subtotal.pending.toString()).toBe('100.00');
  });

  it('CA54: status PENDING/PAID repassado ao read model', async () => {
    const rm = readModel();
    await ownedUseCase(ListExpenses, rm as never).execute({ month: '2026-10', status: 'PENDING' });
    expect(criteriaOf(rm).status).toBe('PENDING');
  });

  it('CA55: cardId UUID -> filtro card; "pix" -> filtro pix', async () => {
    const rm1 = readModel();
    await ownedUseCase(ListExpenses, rm1 as never).execute({ month: '2026-10', cardId: cardUuid(1) });
    expect(criteriaOf(rm1).card.kind).toBe('card');
    expect(criteriaOf(rm1).card.cardId.value).toBe(cardUuid(1));
    const rm2 = readModel();
    await ownedUseCase(ListExpenses, rm2 as never).execute({ month: '2026-10', cardId: 'pix' });
    expect(criteriaOf(rm2).card).toEqual({ kind: 'pix' });
  });

  it('CA56: categoria normalizada para a chave case-insensitive', async () => {
    const rm = readModel();
    await ownedUseCase(ListExpenses, rm as never).execute({ month: '2026-10', category: '  MORADIA ' });
    expect(criteriaOf(rm).categoryKey).toBe('moradia');
  });

  it('paginacao explicita e totalPages = ceil(total / pageSize)', async () => {
    const rm = readModel(41);
    const result = await ownedUseCase(ListExpenses, rm as never).execute({ month: '2026-10', page: '3', pageSize: '10' });
    expect(criteriaOf(rm).paging).toEqual({ page: 3, pageSize: 10 });
    expect(result.pagination).toEqual({ page: 3, pageSize: 10, totalItems: 41, totalPages: 5 });
  });

  it('pagina alem do fim: items vazio com metadados corretos', async () => {
    const result = await ownedUseCase(ListExpenses, readModel(5) as never).execute({ month: '2026-10', page: '9' });
    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({ page: 9, pageSize: 20, totalItems: 5, totalPages: 1 });
  });

  it('CA58/P19: resultado vazio -> totalPages 0 e subtotal zero', async () => {
    const result = await ownedUseCase(ListExpenses, readModel(0, { paid: '0.00', pending: '0.00' }) as never).execute({
      month: '2026-10',
      cardId: cardUuid(77),
    });
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    expect(result.subtotal.total.toString()).toBe('0.00');
  });

  describe('CA46/CA57: parametros invalidos -> 400 InvalidQueryError', () => {
    it.each([
      ['mes ausente', {}, 'month', 'REQUIRED'],
      ['mes 2026-13', { month: '2026-13' }, 'month', 'INVALID_FORMAT'],
      ['status RECEIVED', { month: '2026-10', status: 'RECEIVED' }, 'status', 'INVALID_VALUE'],
      ['status minusculo', { month: '2026-10', status: 'pending' }, 'status', 'INVALID_VALUE'],
      ['cardId mal formado', { month: '2026-10', cardId: 'abc' }, 'cardId', 'INVALID_FORMAT'],
      ['cardId "none" (legado)', { month: '2026-10', cardId: 'none' }, 'cardId', 'INVALID_FORMAT'],
      ['category vazia', { month: '2026-10', category: '' }, 'category', null],
      ['pageSize 101', { month: '2026-10', pageSize: '101' }, 'pageSize', null],
      ['pageSize 0', { month: '2026-10', pageSize: '0' }, 'pageSize', null],
      ['page 0', { month: '2026-10', page: '0' }, 'page', null],
      ['page nao numerica', { month: '2026-10', page: 'x' }, 'page', null],
    ])('%s', async (_label, input, field, code) => {
      const rm = readModel();
      const error = await rejected(ownedUseCase(ListExpenses, rm as never).execute(input as never));
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
      expect(error.details.fields).toContainEqual(
        expect.objectContaining(code ? { field, code } : { field }),
      );
      expect(rm.listExpenses).not.toHaveBeenCalled();
    });

    it('acumula varias violacoes em um unico erro', async () => {
      const error = await rejected(
        ownedUseCase(ListExpenses, readModel() as never).execute({ month: '2026-13', status: 'X', cardId: 'abc' } as never),
      );
      expect(error.details.fields.map((f: { field: string }) => f.field).sort()).toEqual(['cardId', 'month', 'status']);
    });
  });
});

describe('ListExpenses - teto de page', () => {
  it('page acima de 1.000.000 -> OUT_OF_RANGE; igual ao teto e aceito', async () => {
    const error = await rejected(ownedUseCase(ListExpenses, readModel() as never).execute({ month: '2026-10', page: '1000001' }));
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'page', code: 'OUT_OF_RANGE' }));
    await expect(ownedUseCase(ListExpenses, readModel() as never).execute({ month: '2026-10', page: '1000000' })).resolves.toBeDefined();
  });
});
