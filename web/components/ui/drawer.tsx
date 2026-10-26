"use client";

import type { ReactNode } from "react";
import { ModalDialog } from "./modal-dialog";
import { IconButton } from "./button";

interface DrawerProps {
  title: string;
  titleId: string;
  onClose: () => void;
  onEscape?: () => boolean;
  busy?: boolean;
  initialFocus?: string;
  /** Rodape fixo (acoes) */
  footer: ReactNode;
  children: ReactNode;
}

/** Drawer lateral (>= md) / tela cheia (< md) com cabecalho e rodape fixos e corpo rolavel (D1). */
export function Drawer({ title, titleId, onClose, onEscape, busy = false, initialFocus, footer, children }: DrawerProps) {
  return (
    <ModalDialog variant="drawer" labelledBy={titleId} onClose={onClose} onEscape={onEscape} busy={busy} initialFocus={initialFocus}>
      <div className="flex h-dvh flex-col bg-surface">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id={titleId} className="font-display text-xl font-semibold text-text">
            {title}
          </h2>
          <IconButton aria-label="Fechar" onClick={onClose} disabled={busy}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <footer className="border-t border-border-strong bg-surface px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>
      </div>
    </ModalDialog>
  );
}
