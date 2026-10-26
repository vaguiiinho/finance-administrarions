"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type AnchorHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";

/** Quais regioes entram em "Atualizando": mes = tudo; painel = so a aba; resumo = so o resumo. */
export type NavScope = "all" | "panel" | "summary";

interface NavigateOptions {
  scope?: NavScope;
  /** Id do elemento que recebe o foco quando a navegacao terminar (ex.: h2 do painel). */
  focusId?: string;
  replace?: boolean;
}

interface NavContextValue {
  pending: NavScope | null;
  navigate: (href: string, options?: NavigateOptions) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav fora de <NavProvider>");
  return ctx;
}

/** Como `useNav`, mas devolve `null` fora do provider (consumidores opcionais, ex.: expirar o destaque ao navegar). */
export function useOptionalNav(): NavContextValue | null {
  return useContext(NavContext);
}

/**
 * Toda navegacao de estado (mes, aba, filtro, pagina) passa por uma transicao: o conteudo antigo permanece
 * com as cores normais enquanto a regiao afetada mostra "Atualizando…" (D11) - sem opacidade.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState<NavScope>("panel");
  const focusRef = useRef<string | null>(null);
  const wasPending = useRef(false);

  const navigate = useCallback(
    (href: string, options: NavigateOptions = {}) => {
      setScope(options.scope ?? "panel");
      focusRef.current = options.focusId ?? null;
      startTransition(() => {
        if (options.replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [router],
  );

  useEffect(() => {
    if (wasPending.current && !isPending && focusRef.current) {
      document.getElementById(focusRef.current)?.focus({ preventScroll: false });
      focusRef.current = null;
    }
    wasPending.current = isPending;
  }, [isPending]);

  const value = useMemo(() => ({ pending: isPending ? scope : null, navigate }), [isPending, scope, navigate]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  ref?: Ref<HTMLAnchorElement>;
  scope?: NavScope;
  focusId?: string;
}

/** Link real (abre em nova aba, copiavel) que, no clique simples, navega dentro da transicao de "Atualizando". */
export function NavLink({ href, scope, focusId, onClick, children, ref, ...rest }: NavLinkProps) {
  const { navigate } = useNav();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href, { scope, focusId });
  };
  return (
    <Link ref={ref} href={href} onClick={handleClick} scroll={false} {...rest}>
      {children}
    </Link>
  );
}

interface UpdatingRegionProps {
  scope: Exclude<NavScope, "all">;
  children: ReactNode;
  className?: string;
  /** Mostra o texto "Atualizando…" (padrao). */
  label?: boolean;
}

/** Regiao com `aria-busy`, barra de progresso de 2px e "Atualizando…" (D11). */
export function UpdatingRegion({ scope, children, className = "", label = true }: UpdatingRegionProps) {
  const { pending } = useNav();
  const busy = pending === "all" || pending === scope;
  return (
    <div aria-busy={busy} className={`relative ${className}`.trim()}>
      {busy ? <div className="progress" aria-hidden="true" /> : null}
      {busy && label ? (
        <p role="status" className="absolute -top-6 right-0 text-sm text-muted">
          Atualizando…
        </p>
      ) : null}
      {children}
    </div>
  );
}
