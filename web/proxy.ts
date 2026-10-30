import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api/api-url";
import { sessionCookieName, sessionCookieSecure } from "@/lib/auth/cookie-name";
import { decideRoute, type ProxySession } from "@/lib/auth/route-policy";

const ME_TIMEOUT_MS = 2000;

/** `GET /api/auth/me` resumido para o `/login` com cookie (ADR 9.3). Falha de rede ou 5xx nao derruba o login: segue como `null`. */
async function probeSession(token: string, request: NextRequest): Promise<ProxySession | null> {
  try {
    const headers = new Headers({ authorization: `Bearer ${token}` });
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) headers.set("x-forwarded-for", forwarded);
    const response = await fetch(`${apiBaseUrl()}/api/auth/me`, { headers, cache: "no-store", signal: AbortSignal.timeout(ME_TIMEOUT_MS) });
    if (response.status === 401) return "invalid";
    if (!response.ok) return null;
    const me = (await response.json()) as { mustChangePassword?: boolean };
    return me.mustChangePassword ? "must-change-password" : "valid";
  } catch {
    return null;
  }
}

/** Caminho + query da tela, sem o parametro interno `_rsc` das navegacoes do cliente. */
function currentUrl(request: NextRequest): { pathname: string; search: string } {
  const { pathname } = request.nextUrl;
  if (!request.nextUrl.searchParams.has("_rsc")) return { pathname, search: request.nextUrl.search };
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete("_rsc");
  const query = params.toString();
  return { pathname, search: query ? `?${query}` : "" };
}

/**
 * Redirecionamentos otimistas por presenca do cookie (ADR 0005 9.3): nivel e troca obrigatoria ficam no layout e na API.
 * Injeta `x-fa-url` (caminho + query) para os layouts e readers montarem `next`.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const name = sessionCookieName();
  const token = request.cookies.get(name)?.value;
  const { pathname, search } = currentUrl(request);

  // Mutacoes (Server Actions) sempre chegam a action: sem cookie ela responde SESSION_EXPIRED, que a tela mostra no dialogo
  if (request.method !== "GET" && request.method !== "HEAD") return withUrl(request, pathname + search);

  let decision = decideRoute(pathname, search, Boolean(token));
  let staleCookie = false;
  if (decision.kind === "validate-session" && token) {
    const session = await probeSession(token, request);
    staleCookie = session === "invalid";
    decision = session === null ? { kind: "next" } : decideRoute(pathname, search, true, session);
  }

  if (decision.kind === "redirect") return NextResponse.redirect(new URL(decision.to, request.url));

  const response = withUrl(request, pathname + search);
  if (staleCookie) response.cookies.delete({ name, path: "/", secure: sessionCookieSecure(), httpOnly: true, sameSite: "lax" });
  return response;
}

function withUrl(request: NextRequest, url: string): NextResponse {
  const headers = new Headers(request.headers);
  headers.set("x-fa-url", url);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
