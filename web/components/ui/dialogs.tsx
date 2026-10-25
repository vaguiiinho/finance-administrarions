"use client";

import { useId, type ReactNode } from "react";
import { Button } from "./button";
import { ModalDialog } from "./modal-dialog";

interface AlertDialogProps {
  title: string;
  /** Corpo do alerta (detalhes da acao) */
  children: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** Mensagem de erro inline (400/500/rede): o modal continua aberto. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmacao de acao irreversivel (D2): foco inicial em "Cancelar", Esc cancela (ignorado durante o envio). */
export function AlertDialog({ title, children, confirmLabel, busyLabel = "Aguarde…", cancelLabel = "Cancelar", busy = false, error, onConfirm, onCancel }: AlertDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <ModalDialog variant="modal" role="alertdialog" labelledBy={titleId} describedBy={bodyId} onClose={onCancel} busy={busy} initialFocus="[data-cancel]">
      <h2 id={titleId} className="font-display text-xl font-semibold text-text">
        {title}
      </h2>
      <div id={bodyId} className="mt-3 flex flex-col gap-2 text-text">
        {children}
        <p className="flex items-center gap-2 text-sm text-warning-text">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
            <path d="M12 10v4M12 17v.5" strokeLinecap="round" />
          </svg>
          Esta ação não pode ser desfeita.
        </p>
      </div>
      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger-text">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button data-cancel onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant="primary" loading={busy} onClick={onConfirm}>
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </ModalDialog>
  );
}
