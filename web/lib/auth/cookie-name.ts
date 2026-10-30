/**
 * Nome e `Secure` do cookie de sessao (ADR 0005 9.2). Sem `server-only`: o `proxy.ts` (runtime do proxy) tambem le.
 * `Secure` fora do ambiente local: producao liga, a menos que `SESSION_COOKIE_SECURE=false` (deploy atras de HTTP).
 */
export function sessionCookieSecure(): boolean {
  const override = process.env.SESSION_COOKIE_SECURE;
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** `fa_session`; com `Secure` (producao) o prefixo `__Host-` (host-only, Path=/, sem Domain). */
export function sessionCookieName(): string {
  return sessionCookieSecure() ? "__Host-fa_session" : "fa_session";
}
