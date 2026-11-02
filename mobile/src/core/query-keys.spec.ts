import { isFinanceQuery, queryKeys } from '@/core/query-keys';

describe('isFinanceQuery (ADR 0011 10.8)', () => {
  it.each([
    ['summary', '2026-11'],
    ['series', '2026-11'],
    ['category-distribution', '2026-11'],
    ['expenses', '2026-11', {}],
    ['incomes', '2026-11', {}],
    ['invoices', '2026-11', 'PENDING'],
    ['invoice-entries', 'c1', '2026-11'],
    ['categories'],
    ['initial-month'],
  ])('inclui %j', (...key) => expect(isFinanceQuery({ queryKey: key } as never)).toBe(true));
  it.each([['me'], ['cards']])('exclui %j', (...key) => expect(isFinanceQuery({ queryKey: key } as never)).toBe(false));
});

describe('queryKeys', () => {
  it('monta as chaves esperadas', () => {
    expect(queryKeys.me()).toEqual(['me']);
    expect(queryKeys.summary('2026-11')).toEqual(['summary', '2026-11']);
    expect(queryKeys.series('2026-11')).toEqual(['series', '2026-11']);
    expect(queryKeys.categoryDistribution('2026-11')).toEqual(['category-distribution', '2026-11']);
    expect(queryKeys.expenses('2026-11', { q: 'a' })).toEqual(['expenses', '2026-11', { q: 'a' }]);
    expect(queryKeys.incomes('2026-11', {})).toEqual(['incomes', '2026-11', {}]);
    expect(queryKeys.invoices('2026-11', 'PENDING')).toEqual(['invoices', '2026-11', 'PENDING']);
    expect(queryKeys.invoiceEntries('c1', '2026-11')).toEqual(['invoice-entries', 'c1', '2026-11']);
    expect(queryKeys.categories()).toEqual(['categories']);
    expect(queryKeys.cards()).toEqual(['cards']);
    expect(queryKeys.initialMonth()).toEqual(['initial-month']);
  });
  it('toda chave financeira satisfaz isFinanceQuery; me e cards nao', () => {
    const finance = [
      queryKeys.summary('m'), queryKeys.series('m'), queryKeys.categoryDistribution('m'), queryKeys.expenses('m', {}),
      queryKeys.incomes('m', {}), queryKeys.invoices('m', 's'), queryKeys.invoiceEntries('c', 'm'), queryKeys.categories(), queryKeys.initialMonth(),
    ];
    for (const queryKey of finance) expect(isFinanceQuery({ queryKey })).toBe(true);
    expect(isFinanceQuery({ queryKey: queryKeys.me() })).toBe(false);
    expect(isFinanceQuery({ queryKey: queryKeys.cards() })).toBe(false);
  });
  it('chave vazia ou raiz nao-string nao e financeira', () => {
    expect(isFinanceQuery({ queryKey: [] })).toBe(false);
    expect(isFinanceQuery({ queryKey: [42] })).toBe(false);
    expect(isFinanceQuery({ queryKey: ['unknown'] })).toBe(false);
  });
});
