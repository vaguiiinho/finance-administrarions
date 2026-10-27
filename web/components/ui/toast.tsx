"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconButton } from "./button";

export type ToastKind = "success" | "error" | "info";

export interface ToastInput {
  kind: ToastKind;
  message: string;
  action?: { label: string; href: string };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ push: (toast: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fora de <ToastProvider>");
  return ctx;
}

const BORDER: Record<ToastKind, string> = {
  success: "border-l-success",
  error: "border-l-danger",
  info: "border-l-accent",
};
const ICON_COLOR: Record<ToastKind, string> = {
  success: "text-success-text",
  error: "text-danger-text",
  info: "text-accent",
};

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  // sucesso/info: 5s (8s com acao); erros nao somem sozinhos; pausa com hover/foco.
  const timeout = toast.kind === "error" ? null : toast.action ? 8000 : 5000;
  useEffect(() => {
    if (timeout === null || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), timeout);
    return () => clearTimeout(timer);
  }, [timeout, paused, toast.id, onDismiss]);

  return (
    <div
      role={toast.kind === "error" ? "alert" : undefined}
      data-testid="toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-border-strong border-l-[3px] bg-surface-2 py-2 pl-3 pr-1 text-sm text-text shadow-lg ${BORDER[toast.kind]}`}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`mt-2.5 shrink-0 ${ICON_COLOR[toast.kind]}`}>
        {toast.kind === "success" ? <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {toast.kind === "error" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
          </>
        ) : null}
        {toast.kind === "info" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.5" strokeLinecap="round" />
          </>
        ) : null}
      </svg>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 py-2.5">
        <p>{toast.message}</p>
        {toast.action ? (
          <Link href={toast.action.href} className="font-medium text-accent underline" onClick={() => onDismiss(toast.id)}>
            {toast.action.label}
          </Link>
        ) : null}
      </div>
      <IconButton aria-label="Fechar aviso" onClick={() => onDismiss(toast.id)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </IconButton>
    </div>
  );
}

/** Ate 3 toasts: canto inferior direito (desktop) ou topo, abaixo da navbar (mobile). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback((toast: ToastInput) => {
    setToasts((list) => [...list, { ...toast, id: nextId.current++ }].slice(-3));
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-[calc(var(--navbar-h)+var(--tabsbar-h)+8px)] z-50 flex flex-col gap-2 md:inset-x-auto md:bottom-4 md:right-4 md:top-auto md:w-[380px]"
      >
        {/* Regioes vivas sempre montadas (anuncio confiavel): sucesso/info = status; erro = alert */}
        <div role="status" className="flex flex-col gap-2">
          {toasts.filter((t) => t.kind !== "error").map((toast) => (
            <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {toasts.filter((t) => t.kind === "error").map((toast) => (
            <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
