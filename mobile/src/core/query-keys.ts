/** Chaves e predicados do cache (ADR 0011 10.8). Todas as financeiras entram em `isFinanceQuery`, menos `me` e `cards`. */
export const queryKeys = {
  me: () => ['me'] as const,
  summary: (month: string) => ['summary', month] as const,
  series: (month: string) => ['series', month] as const,
  categoryDistribution: (month: string) => ['category-distribution', month] as const,
  expenses: (month: string, filters: object) => ['expenses', month, filters] as const,
  incomes: (month: string, filters: object) => ['incomes', month, filters] as const,
  invoices: (month: string, status: string) => ['invoices', month, status] as const,
  invoiceEntries: (cardId: string, referenceMonth: string) => ['invoice-entries', cardId, referenceMonth] as const,
  categories: () => ['categories'] as const,
  cards: () => ['cards'] as const,
  initialMonth: () => ['initial-month'] as const,
};

const FINANCE_ROOTS = new Set([
  'summary',
  'series',
  'category-distribution',
  'expenses',
  'incomes',
  'invoices',
  'invoice-entries',
  'categories',
  'initial-month',
]);

export function isFinanceQuery(query: { queryKey: readonly unknown[] }): boolean {
  const root = query.queryKey[0];
  return typeof root === 'string' && FINANCE_ROOTS.has(root);
}
