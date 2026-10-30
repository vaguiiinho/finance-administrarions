"use client";

import type { ReactNode } from "react";
import { AlertDialog } from "@/components/ui/dialogs";
import { Money } from "@/components/ui/money";
import { sumDecimals } from "@/lib/money/decimal";
import { countLabel } from "@/lib/entries/feedback";
import type { EntryDto } from "@/lib/api/types";

interface PayConfirmDialogProps {
  items: EntryDto[];
  /** Individual (uma linha) ou lote (selecao); lote de 1 continua sendo lote */
  mode: "single" | "batch";
  busy: boolean;
  error: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const MAX_LISTED = 5;

/** Confirmacao de pagamento individual ou em lote (design 3.10): total, ate 5 itens + "e mais n", foco em "Cancelar". */
export function PayConfirmDialog({ items, mode, busy, error, onConfirm, onCancel }: PayConfirmDialogProps) {
  const single = mode === "single";
  const title = single ? `Marcar "${items[0].description}" como pago?` : `Marcar ${countLabel(items.length, "despesa", "despesas")} como ${items.length === 1 ? "paga" : "pagas"}?`;
  return (
    <AlertDialog title={title} confirmLabel="Marcar como pago" busyLabel="Pagando…" busy={busy} error={error} onConfirm={onConfirm} onCancel={onCancel}>
      <p className="font-display text-xl font-semibold">
        Total: <Money value={sumDecimals(items.map((i) => i.amount))} />
      </p>
      {!single ? (
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {items.slice(0, MAX_LISTED).map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="truncate">{item.description}</span>
              <Money value={item.amount} />
            </li>
          ))}
          {items.length > MAX_LISTED ? <li>e mais {items.length - MAX_LISTED}</li> : null}
        </ul>
      ) : null}
    </AlertDialog>
  );
}
