"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { ModalDialog } from "./modal-dialog";

interface BottomSheetProps {
  title: string;
  titleId: string;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: ReactNode;
}

/** Folha de filtros (< md): aplica em lote pelo botao "Aplicar" (D6). */
export function BottomSheet({ title, titleId, onClose, onClear, onApply, children }: BottomSheetProps) {
  return (
    <ModalDialog variant="sheet" labelledBy={titleId} onClose={onClose}>
      <div className="flex max-h-[90dvh] flex-col bg-surface">
        <h2 id={titleId} className="border-b border-border px-5 py-3 font-display text-xl font-semibold text-text">
          {title}
        </h2>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-between gap-3 border-t border-border-strong px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button onClick={onClear}>Limpar</Button>
          <Button variant="primary" onClick={onApply}>
            Aplicar
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
