"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface EntryDrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const EntryDrawerContext = createContext<EntryDrawerContextValue | null>(null);

export function useEntryDrawer(): EntryDrawerContextValue {
  const ctx = useContext(EntryDrawerContext);
  if (!ctx) throw new Error("useEntryDrawer fora de <EntryDrawerProvider>");
  return ctx;
}

/** Estado de abertura do drawer, acima do Suspense: o formulario sobrevive a revalidacoes da pagina (CA75, CA84). */
export function EntryDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openDrawer, closeDrawer }), [open, openDrawer, closeDrawer]);
  return <EntryDrawerContext.Provider value={value}>{children}</EntryDrawerContext.Provider>;
}

/** "+ Novo lançamento": o foco volta a este botao ao fechar o drawer (comportamento nativo do <dialog>). */
export function NewEntryButton({ variant = "primary", className = "", ...props }: Omit<ButtonProps, "onClick" | "children">) {
  const { openDrawer } = useEntryDrawer();
  return (
    <Button variant={variant} className={className} onClick={openDrawer} {...props}>
      + Novo lançamento
    </Button>
  );
}
