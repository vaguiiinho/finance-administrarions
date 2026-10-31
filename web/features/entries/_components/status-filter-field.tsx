"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { StatusFilter } from "@/lib/filters/entries-search-params";

/** Opcoes de status compartilhadas por Despesas e Faturas (RF16, ordem fixa). */
export const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendente" },
  { value: "PAID", label: "Pago" },
] as const;

export const STATUS_LABEL: Record<StatusFilter, string> = { ALL: "Todos", PENDING: "Pendente", PAID: "Pago" };

/** Campo "Status" (rotulo + radiogroup) usado inline e na folha. */
export function StatusField({ idPrefix, value, onChange }: { idPrefix: string; value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${idPrefix}-status`} className="text-sm font-medium text-text">
        Status
      </span>
      <SegmentedControl<StatusFilter> aria-labelledby={`${idPrefix}-status`} options={STATUS_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}

/** Indicacao "Status: <ativo>" abaixo de md (DL6): texto estatico, fora de regiao viva; mostra o status APLICADO. */
export function StatusIndicator({ status }: { status: StatusFilter }) {
  return <p className="text-sm text-muted md:hidden">{`Status: ${STATUS_LABEL[status]}`}</p>;
}
