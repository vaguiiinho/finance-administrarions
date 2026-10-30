"use client";

import { MonthPicker } from "@/components/month-picker";
import { useAppMode } from "@/components/app-mode";
import { useNav } from "@/components/navigation";
import { changeMonth, entriesHref, type EntriesState } from "@/lib/filters/entries-search-params";

/** Troca de mes (D19): mantem aba e filtros, volta a pagina 1; resumo e painel entram em "Atualizando". */
export function EntriesMonthPicker({ state, currentMonth, variant = "full" }: { state: EntriesState; currentMonth: string; variant?: "full" | "compact" }) {
  const { navigate } = useNav();
  const { basePath } = useAppMode();
  return <MonthPicker month={state.month} currentMonth={currentMonth} variant={variant} onSelect={(month) => navigate(entriesHref(changeMonth(state, month), basePath), { scope: "all" })} />;
}
