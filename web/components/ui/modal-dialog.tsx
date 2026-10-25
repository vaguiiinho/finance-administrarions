"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type DialogVariant = "modal" | "drawer" | "sheet";

interface ModalDialogProps {
  /** Rotulo do dialogo (id do titulo) */
  labelledBy: string;
  describedBy?: string;
  variant: DialogVariant;
  role?: "dialog" | "alertdialog";
  /** Chamado por Esc ou clique no scrim; ignorado enquanto `busy`. */
  onClose: () => void;
  /** Esc tratado por um filho (ex.: painel de novo cartao). Retorne true para NAO fechar o dialogo. */
  onEscape?: () => boolean;
  /** Fecha ao clicar no scrim (padrao: apenas drawer/sheet). */
  closeOnBackdrop?: boolean;
  busy?: boolean;
  /** Seletor do elemento que recebe o foco inicial (padrao: primeiro focavel). */
  initialFocus?: string;
  children: ReactNode;
}

const CLASS: Record<DialogVariant, string> = {
  modal: "modal",
  drawer: "drawer drawer-right",
  sheet: "drawer drawer-sheet",
};

/**
 * `<dialog>` nativo com showModal(): foco preso, Esc e fundo inerte nativos (D7). Montado so quando aberto;
 * ao desmontar, fecha e devolve o foco ao gatilho.
 */
export function ModalDialog({ labelledBy, describedBy, variant, role, onClose, onEscape, closeOnBackdrop, busy = false, initialFocus, children }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeOnScrim = closeOnBackdrop ?? variant !== "modal";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
    // abre uma unica vez por montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={ref}
      className={CLASS[variant]}
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (busy) return;
        if (onEscape?.()) return;
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && closeOnScrim && !busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
