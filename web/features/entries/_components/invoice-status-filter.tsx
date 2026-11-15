"use client";

import { useId, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useNav } from "@/components/navigation";
import { changeFilter, clearInvoiceFilters, entriesHref, type EntriesState, type StatusFilter } from "@/lib/filters/entries-search-params";
import { PANEL_TITLE_ID } from "./panel-ids";
import { StatusField, StatusIndicator } from "./status-filter-field";

/**
 * Filtro de status da aba Faturas (RF16, design 3.1): inline em >= md (aplica ao mudar); folha com "Aplicar" em < md.
 * `f_status` e independente de `d_status` (RF19). "Limpar filtros" leva a Todos e o foco ao h2 do painel (DL7).
 */
export function InvoiceStatusFilter({ state }: { state: EntriesState }) {
  const { navigate } = useNav();
  const uid = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = state.invoices.status;
  const [draft, setDraft] = useState<StatusFilter>(active);
  const count = active === "ALL" ? 0 : 1;

  const apply = (status: StatusFilter, focusId?: string) => navigate(entriesHref(changeFilter(state, { f_status: status })), { scope: "panel", focusId });
  const clear = () => navigate(entriesHref(clearInvoiceFilters(state)), { scope: "panel", focusId: PANEL_TITLE_ID });

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden flex-wrap items-end gap-4 md:flex">
        <StatusField idPrefix={`${uid}-inline`} value={active} onChange={(v) => apply(v)} />
        {count > 0 ? (
          <Button variant="tertiary" onClick={clear}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-3 md:hidden">
        <Button
          aria-haspopup="dialog"
          onClick={() => {
            setDraft(active);
            setSheetOpen(true);
          }}
        >
          Filtros{count > 0 ? ` (${count})` : ""}
        </Button>
        {count > 0 ? (
          <Button variant="tertiary" aria-label="Limpar filtros" onClick={clear}>
            Limpar
          </Button>
        ) : null}
      </div>
      <StatusIndicator status={active} />

      {sheetOpen ? (
        <BottomSheet
          title="Filtros"
          titleId={`${uid}-sheet-title`}
          onClose={() => setSheetOpen(false)}
          onClear={() => setDraft("ALL")}
          onApply={() => {
            setSheetOpen(false);
            apply(draft);
          }}
        >
          <StatusField idPrefix={`${uid}-sheet`} value={draft} onChange={setDraft} />
        </BottomSheet>
      ) : null}
    </div>
  );
}
