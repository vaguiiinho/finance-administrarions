import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionCookieName, sessionCookieSecure } from "./cookie-name";

afterEach(() => vi.unstubAllEnvs());

describe("cookie-name (ADR 9.2, SESSION_COOKIE_SECURE)", () => {
  it("producao: Secure e prefixo __Host-", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect([sessionCookieSecure(), sessionCookieName()]).toEqual([true, "__Host-fa_session"]);
  });
  it("producao atras de HTTP: SESSION_COOKIE_SECURE=false desliga Secure e o prefixo (o navegador rejeitaria __Host- sem Secure)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect([sessionCookieSecure(), sessionCookieName()]).toEqual([false, "fa_session"]);
  });
  it("SESSION_COOKIE_SECURE=true liga Secure tambem fora de producao", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    expect(sessionCookieSecure()).toBe(true);
  });
});
