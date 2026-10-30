import type { CurrentUserDto } from "@/lib/api/types";
import { loginUrl } from "./next-param";

/** Resultado do `proxy.ts` (ADR 9.3). `validate-session`: `/login` com cookie precisa de `GET /auth/me` antes de decidir. */
export type RouteDecision = { kind: "next" } | { kind: "redirect"; to: string } | { kind: "validate-session" };
/** Resposta de `GET /auth/me` ja resumida para `/login` com cookie. */
export type ProxySession = "valid" | "must-change-password" | "invalid";

const PROTECTED_PREFIXES = ["/entries", "/dashboard", "/cards", "/account", "/admin"] as const;
const isProtectedPath = (pathname: string) => PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function decideRoute(pathname: string, search: string, hasCookie: boolean, session?: ProxySession): RouteDecision {
  if (pathname === "/") return { kind: "redirect", to: hasCookie ? "/entries" : "/demo/entries" };
  if (pathname === "/login") {
    if (!hasCookie) return { kind: "next" };
    if (session === undefined) return { kind: "validate-session" };
    if (session === "valid") return { kind: "redirect", to: "/entries" };
    if (session === "must-change-password") return { kind: "redirect", to: "/account/password" };
    return { kind: "next" };
  }
  if (!hasCookie && isProtectedPath(pathname)) return { kind: "redirect", to: loginUrl(`${pathname}${search}`) };
  return { kind: "next" };
}

export type LayoutDecision = { kind: "allow" } | { kind: "redirect"; to: string } | { kind: "notFound" };

/** `(protected)/layout.tsx` (ADR 9.4): sem usuario -> login; troca obrigatoria fora de `/account/password` -> la. */
export function decideProtectedLayout(user: CurrentUserDto | null, url: string, options: { hadSession?: boolean } = {}): LayoutDecision {
  // havia cookie mas a API nao reconhece a sessao: expirou/foi encerrada (PA1, CA06)
  if (!user) return { kind: "redirect", to: loginUrl(url, options.hadSession ? { reason: "expired" } : {}) };
  if (user.mustChangePassword) {
    const path = url.split(/[?#]/)[0];
    if (path !== "/account/password") return { kind: "redirect", to: `/account/password?next=${encodeURIComponent(url)}` };
  }
  return { kind: "allow" };
}

/** `(protected)/admin/layout.tsx`: `role !== 'ADMIN'` -> notFound (RF10, CA15). */
export function decideAdminLayout(user: CurrentUserDto | null): LayoutDecision {
  return user?.role === "ADMIN" ? { kind: "allow" } : { kind: "notFound" };
}
