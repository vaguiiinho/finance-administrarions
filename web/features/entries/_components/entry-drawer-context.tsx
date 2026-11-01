"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useOptionalNav } from "@/components/navigation";
import { WriteOnly } from "@/components/read-only";

interface EntryDrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  installmentsOpen: boolean;
  openInstallmentsDrawer: () => void;
  closeInstallmentsDrawer: () => void;
  /** Lancamento recem-criado (destaque temporario, D25); `seq` distingue marcacoes repetidas do mesmo id. */
  recent: { id: string; seq: number } | null;
  markRecent: (id: string) => void;
  /** Chamado pela linha/card destacado ao ser renderizado: inicia a contagem dos ~2s (F2). Idempotente por `seq`. */
  beginRecent: (seq: number) => void;
}

/** Duracao do destaque da linha recem-criada (design 3.9.2), contada a partir de quando a linha aparece. */
export const RECENT_HIGHLIGHT_MS = 2000;
/** Se a linha nunca aparecer (outra pagina, erro de revalidacao), a marcacao expira sozinha. */
const RECENT_MAX_WAIT_MS = 15000;

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
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const openInstallmentsDrawer = useCallback(() => setInstallmentsOpen(true), []);
  const closeInstallmentsDrawer = useCallback(() => setInstallmentsOpen(false), []);
  const [recent, setRecent] = useState<{ id: string; seq: number } | null>(null);
  const seqRef = useRef(0);
  const startedSeq = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const expire = useCallback((seq: number, ms: number) => {
    clearTimer();
    timer.current = setTimeout(() => setRecent((current) => (current?.seq === seq ? null : current)), ms);
  }, []);
  const markRecent = useCallback(
    (id: string) => {
      const seq = ++seqRef.current;
      startedSeq.current = null;
      setRecent({ id, seq });
      expire(seq, RECENT_MAX_WAIT_MS);
    },
    [expire],
  );
  const beginRecent = useCallback(
    (seq: number) => {
      if (startedSeq.current === seq || seqRef.current !== seq) return;
      startedSeq.current = seq;
      expire(seq, RECENT_HIGHLIGHT_MS);
    },
    [expire],
  );
  useEffect(() => clearTimer, []);
  // Navegar (mes, aba, filtro, pagina) encerra o destaque: a marcacao vale so para a tela em que o item foi criado.
  const navigating = useOptionalNav()?.pending != null;
  const [wasNavigating, setWasNavigating] = useState(false);
  if (navigating !== wasNavigating) {
    setWasNavigating(navigating);
    if (navigating) setRecent(null); // o timer pendente so zera se o `seq` ainda for o atual: inofensivo
  }
  const value = useMemo(
    () => ({
      open,
      openDrawer,
      closeDrawer,
      installmentsOpen,
      openInstallmentsDrawer,
      closeInstallmentsDrawer,
      recent,
      markRecent,
      beginRecent,
    }),
    [open, openDrawer, closeDrawer, installmentsOpen, openInstallmentsDrawer, closeInstallmentsDrawer, recent, markRecent, beginRecent],
  );
  return <EntryDrawerContext.Provider value={value}>{children}</EntryDrawerContext.Provider>;
}

function NewEntryButtonImpl({ variant = "primary", className = "", ...props }: Omit<ButtonProps, "onClick" | "children">) {
  const { openDrawer } = useEntryDrawer();
  return (
    <Button variant={variant} className={className} onClick={openDrawer} {...props}>
      + Novo lançamento
    </Button>
  );
}

/** "+ Novo lançamento": o foco volta a este botao ao fechar o drawer (comportamento nativo do <dialog>). Na demo nao existe (RF31). */
export function NewEntryButton(props: Omit<ButtonProps, "onClick" | "children">) {
  return (
    <WriteOnly>
      <NewEntryButtonImpl {...props} />
    </WriteOnly>
  );
}

function NewInstallmentButtonImpl({ variant = "secondary", className = "", ...props }: Omit<ButtonProps, "onClick" | "children">) {
  const { openInstallmentsDrawer } = useEntryDrawer();
  return (
    <Button variant={variant} className={className} onClick={openInstallmentsDrawer} {...props}>
      + Despesa parcelada
    </Button>
  );
}

export function NewInstallmentButton(props: Omit<ButtonProps, "onClick" | "children">) {
  return (
    <WriteOnly>
      <NewInstallmentButtonImpl {...props} />
    </WriteOnly>
  );
}

/** `true` por ~2s, contados a partir da renderizacao da linha, para o lancamento recem-criado. Fora do provider nunca destaca. */
export function useIsRecent(id: string): boolean {
  const ctx = useContext(EntryDrawerContext);
  const match = ctx?.recent?.id === id;
  const seq = ctx?.recent?.seq;
  const beginRecent = ctx?.beginRecent;
  useEffect(() => {
    if (match && seq !== undefined) beginRecent?.(seq);
  }, [match, seq, beginRecent]);
  return match;
}

/** Selo textual do destaque (nao depende so de cor/realce). */
export function RecentBadge({ id }: { id: string }) {
  if (!useIsRecent(id)) return null;
  return (
    <span className="chip" data-testid="recent-badge">
      Novo<span className="sr-only"> lançamento recém-criado</span>
    </span>
  );
}

/** `<tr>` que recebe o realce estatico (borda de 2px com `--accent` + `--surface-2`) enquanto for o lancamento novo. */
export function EntryRow({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  const recent = useIsRecent(id);
  return (
    <tr data-entry-id={id} tabIndex={-1} data-recent={recent || undefined} className={`${className} ${recent ? "row-highlight" : ""}`.trim()}>
      {children}
    </tr>
  );
}

/** `<li>` (card mobile) com o mesmo realce do `EntryRow`. */
export function EntryItem({ id, className = "", children, ...rest }: { id: string; className?: string; children: ReactNode } & React.LiHTMLAttributes<HTMLLIElement>) {
  const recent = useIsRecent(id);
  return (
    <li data-entry-id={id} tabIndex={-1} data-recent={recent || undefined} className={`${className} ${recent ? "row-highlight" : ""}`.trim()} {...rest}>
      {children}
    </li>
  );
}
