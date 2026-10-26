"use client";

import { useEffect, useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { changeTab, entriesHref, type EntriesState, type EntriesTab } from "@/lib/filters/entries-search-params";
import { EntriesMonthPicker } from "./entries-month-picker";
import { NewEntryButton } from "./entry-drawer-context";

const LABELS: Record<EntriesTab, string> = { expenses: "Despesas", invoices: "Faturas", income: "Receitas" };
const ORDER: EntriesTab[] = ["expenses", "invoices", "income"];

/** Id do bloco do cabecalho com seletor de mes e "+ Novo lancamento" (sentinela da faixa compacta, D16). */
export const HEADER_CONTROLS_ID = "entries-header-controls";

/**
 * Faixa de abas fixa (sticky) abaixo da navbar: fundo opaco `--bg`. A partir de `md`, mostra o mes compacto e
 * "+ Novo lancamento" SOMENTE quando os controles do cabecalho saem da vista (sem controles duplicados visiveis).
 */
export function EntriesTabsBar({ state, currentMonth }: { state: EntriesState; currentMonth: string }) {
  const [headerGone, setHeaderGone] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(HEADER_CONTROLS_ID);
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const navbar = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--navbar-h"), 10) || 64;
    const observer = new IntersectionObserver(([entry]) => setHeaderGone(!entry.isIntersecting && entry.boundingClientRect.bottom < navbar + 8), {
      rootMargin: `-${navbar}px 0px 0px 0px`,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const items: TabItem<EntriesTab>[] = ORDER.map((id) => ({ id, label: LABELS[id], href: entriesHref(changeTab(state, id)) }));

  return (
    <div className="sticky top-[var(--navbar-h)] z-30 -mx-4 border-b border-border bg-bg px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <div className="flex min-h-[var(--tabsbar-h)] items-center gap-3 py-1">
        {headerGone ? (
          <div className="hidden md:block">
            <EntriesMonthPicker state={state} currentMonth={currentMonth} variant="compact" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 md:flex md:justify-center">
          <Tabs items={items} activeId={state.tab} label="Lançamentos do mês" idPrefix="entries" />
        </div>
        {headerGone ? <NewEntryButton variant="secondary" className="hidden md:inline-flex" /> : null}
      </div>
    </div>
  );
}
