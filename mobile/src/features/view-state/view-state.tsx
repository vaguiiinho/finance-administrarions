import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { currentYearMonthSP } from '@/lib/dates/format';
import type { MonthAdvance } from '@/data/api';
import { useSession } from '@/features/session/session-provider';

export type FinanceTab = 'expenses' | 'incomes' | 'invoices';
export type StatusFilter = 'ALL' | 'PENDING' | 'PAID';

export interface FinancesView {
  /** Mes escolhido (null ate a decisao do mes inicial, 5.5). */
  month: string | null;
  tab: FinanceTab;
  status: StatusFilter;
  invoiceStatus: StatusFilter;
  category: string | null;
  cardId: string | null;
  /** Aviso de avanco de mes ainda visivel (6.9). */
  advance: { kind: Exclude<MonthAdvance, 'NONE'>; from: string; to: string } | null;
  /** Ultimos parametros de URL (`tab|status`) ja aplicados nesta aba. */
  urlKey: string | null;
}

const INITIAL_FINANCES: FinancesView = {
  month: null,
  tab: 'expenses',
  status: 'PENDING',
  invoiceStatus: 'PENDING',
  category: null,
  cardId: null,
  advance: null,
  urlKey: null,
};

interface ViewStateValue {
  dashboardMonth: string;
  setDashboardMonth(month: string): void;
  finances: FinancesView;
  patchFinances(patch: Partial<FinancesView>): void;
  /** Troca de mes: preserva aba e filtros e fecha o aviso de avanco. */
  setFinancesMonth(month: string): void;
}

const ViewStateContext = createContext<ViewStateValue | null>(null);

export function useViewState(): ViewStateValue {
  const value = useContext(ViewStateContext);
  if (!value) throw new Error('useViewState fora do ViewStateProvider');
  return value;
}

/** Estado de navegacao das abas enquanto o app esta aberto (P10, DM10): Dashboard e Financas guardam o proprio mes. */
export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [dashboardMonth, setDashboardMonth] = useState(() => currentYearMonthSP());
  const [finances, setFinances] = useState<FinancesView>(INITIAL_FINANCES);
  // Sair / sessao expirada / outra conta: a proxima sessao comeca do zero (ajuste de estado durante a renderizacao).
  const resetKey = useSession().user?.id ?? null;
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setFinances(INITIAL_FINANCES);
    setDashboardMonth(currentYearMonthSP());
  }
  const patchFinances = useCallback((patch: Partial<FinancesView>) => setFinances((current) => ({ ...current, ...patch })), []);
  const setFinancesMonth = useCallback((month: string) => setFinances((current) => ({ ...current, month, advance: null })), []);
  const value = useMemo(
    () => ({ dashboardMonth, setDashboardMonth, finances, patchFinances, setFinancesMonth }),
    [dashboardMonth, finances, patchFinances, setFinancesMonth],
  );
  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>;
}
