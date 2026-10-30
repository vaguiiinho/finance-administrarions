import "server-only";
import { cookies } from "next/headers";
import { sessionCookieName, sessionCookieSecure } from "./cookie-name";

export { sessionCookieName };

export interface SessionCookieOptions {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  expires: Date;
}

/** httpOnly, SameSite=Lax, Path=/, sem Domain; vale ate `session.expiresAt` (24 h, sem renovacao). */
export function sessionCookieOptions(expiresAt: string): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: sessionCookieSecure(), path: "/", expires: new Date(expiresAt) };
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function writeSessionCookie(session: { token: string; expiresAt: string }): Promise<void> {
  (await cookies()).set(sessionCookieName(), session.token, sessionCookieOptions(session.expiresAt));
}

/**
 * Apaga o cookie (logout). Com `refresh: false` (401 numa Server Action) NAO mexe nos cookies: alterar cookies dentro de uma
 * action faz o Next re-renderizar a tela e o layout redirecionaria na hora, antes do aviso "Sua sessao expirou" (design 8,
 * DA10). O cookie obsoleto sai do navegador quando a pessoa chega a `/login`: o `proxy.ts` valida a sessao e o apaga (ADR 9.3).
 */
export async function clearSessionCookie(options: { refresh?: boolean } = {}): Promise<void> {
  if (options.refresh === false) return;
  // `Secure`/`Path` iguais aos da gravacao: o navegador rejeita apagar `__Host-` sem eles
  (await cookies()).delete({ name: sessionCookieName(), path: "/", secure: sessionCookieSecure(), httpOnly: true, sameSite: "lax" });
}
