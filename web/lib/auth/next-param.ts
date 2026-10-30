/** Rotas internas que o `next` pode apontar (ADR 0005 9.5) e o rotulo de cada uma (design 3.3). */
const ALLOWED: readonly { path: string; label: string }[] = [
  { path: "/entries", label: "Lançamentos" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/cards", label: "Cartões" },
  { path: "/account/password", label: "Trocar senha" },
  { path: "/account", label: "Meu perfil" },
  { path: "/admin/users", label: "Usuários" },
];
const FALLBACK = "/entries";

const CONTROL = /[\u0000-\u001f\u007f]/;

function matchRoute(value: string): (typeof ALLOWED)[number] | null {
  const end = value.search(/[?#]/);
  const path = end === -1 ? value : value.slice(0, end);
  return ALLOWED.find((route) => path === route.path || path.startsWith(`${route.path}/`)) ?? null;
}

function isSafe(raw: string | null | undefined): raw is string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return false;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return false;
  }
  if (CONTROL.test(raw) || CONTROL.test(decoded)) return false;
  if (decoded.startsWith("//") || decoded.startsWith("/\\") || decoded.includes("\\")) return false;
  return matchRoute(raw) !== null;
}

/** RF35 / ADR 9.5: so caminhos internos protegidos; qualquer outra coisa vira `/entries`. */
export function safeNext(raw: string | null | undefined): string {
  return isSafe(raw) ? raw : FALLBACK;
}

/** `/login?next=<codificado>[&reason=expired]` (CA06, CA40). */
export function loginUrl(next: string, options: { reason?: "expired" } = {}): string {
  const reason = options.reason ? `&reason=${options.reason}` : "";
  return `/login?next=${encodeURIComponent(next)}${reason}`;
}

/** Rotulo da tela para "Entre para continuar em <tela>." (design 3.3); `null` quando `next` nao e seguro. */
export function nextLabel(raw: string | null | undefined): string | null {
  if (!isSafe(raw)) return null;
  return matchRoute(raw)?.label ?? null;
}
