import { useCallback } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, isFinanceQuery } from '@/core/query-keys';
import { isAccountEmpty } from '@/core/account-empty';
import { useSession } from '@/features/session/session-provider';
import type { ExpenseFilters, IncomeFilters } from './api';

/** Leituras (ADR 0011 10.8). As chaves vem de `src/core/query-keys.ts`. */
export function useSummary(month: string) {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.summary(month), queryFn: () => api.summary(month) });
}

export function useSeries(month: string) {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.series(month), queryFn: () => api.series(month) });
}

export function useCategoryDistribution(month: string) {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.categoryDistribution(month), queryFn: () => api.categoryDistribution(month) });
}

export function useCategories() {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.categories(), queryFn: () => api.categories() });
}

export function useCards() {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.cards(), queryFn: () => api.cards() });
}

/** Sinal de conta sem dados (10.13): so `categories`. `undefined` enquanto carrega ou em erro. */
export function useAccountEmpty(): boolean | undefined {
  const { data } = useCategories();
  return isAccountEmpty(data);
}

export function useInitialMonth(enabled = true) {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.initialMonth(), queryFn: () => api.initialMonth(), enabled, retry: false, staleTime: Infinity });
}

export function useExpenses(month: string | null, filters: ExpenseFilters, enabled = true) {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.expenses(month ?? '', filters),
    enabled: enabled && month !== null,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api.expenses(month!, filters, pageParam, signal),
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useIncomes(month: string | null, filters: IncomeFilters, enabled = true) {
  const { api } = useSession();
  return useInfiniteQuery({
    queryKey: queryKeys.incomes(month ?? '', filters),
    enabled: enabled && month !== null,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api.incomes(month!, filters, pageParam, signal),
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useInvoices(month: string | null, status: 'ALL' | 'PENDING' | 'PAID', enabled = true) {
  const { api } = useSession();
  return useQuery({
    queryKey: queryKeys.invoices(month ?? '', status),
    enabled: enabled && month !== null,
    queryFn: () => api.invoices(month!, status === 'ALL' ? undefined : status),
  });
}

export function useInvoiceEntries(cardId: string, referenceMonth: string) {
  const { api } = useSession();
  return useQuery({ queryKey: queryKeys.invoiceEntries(cardId, referenceMonth), queryFn: () => api.invoiceEntries(cardId, referenceMonth) });
}

/** Regra unica de invalidacao depois de QUALQUER mutacao financeira bem-sucedida (10.8). */
export function useInvalidateFinance() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ predicate: isFinanceQuery }), [queryClient]);
}
