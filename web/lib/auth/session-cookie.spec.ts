import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => store }));

import { clearSessionCookie, readSessionToken, sessionCookieName, sessionCookieOptions, writeSessionCookie } from "./session-cookie";

const EXPIRES = "2026-11-02T13:00:00.000Z";

beforeEach(() => Object.values(store).forEach((f) => f.mockReset()));
afterEach(() => vi.unstubAllEnvs());

describe("cookie de sessao (ADR 9.2, RNF02)", () => {
  it("nome: fa_session fora de producao, __Host-fa_session em producao", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieName()).toBe("fa_session");
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieName()).toBe("__Host-fa_session");
  });

  it("opcoes: httpOnly, SameSite=Lax, Path=/, Expires = expiresAt da sessao (24 h)", () => {
    const o = sessionCookieOptions(EXPIRES);
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(o.expires).toEqual(new Date(EXPIRES));
  });

  it("Secure em producao; sem Secure no ambiente local", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(EXPIRES).secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions(EXPIRES).secure).toBe(false);
  });

  it("nunca define Domain (o prefixo __Host- exige host-only)", () => {
    expect(sessionCookieOptions(EXPIRES)).not.toHaveProperty("domain");
  });

  it("write grava o token com as opcoes; nao ha cookie de nivel/usuario", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await writeSessionCookie({ token: "tok-123", expiresAt: EXPIRES });
    expect(store.set).toHaveBeenCalledTimes(1);
    const [name, value, options] = store.set.mock.calls[0];
    expect(name).toBe("fa_session");
    expect(value).toBe("tok-123");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("read devolve o valor do cookie ou undefined", async () => {
    vi.stubEnv("NODE_ENV", "development");
    store.get.mockReturnValue({ name: "fa_session", value: "tok-9" });
    expect(await readSessionToken()).toBe("tok-9");
    expect(store.get).toHaveBeenCalledWith("fa_session");
    store.get.mockReturnValue(undefined);
    expect(await readSessionToken()).toBeUndefined();
  });

  it("clear apaga o cookie com o mesmo nome", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await clearSessionCookie();
    const deletedByDelete = store.delete.mock.calls.some((c) => c[0] === "fa_session" || c[0]?.name === "fa_session");
    const expiredBySet = store.set.mock.calls.some((c) => c[0] === "fa_session" && (c[1] === "" || c[2]?.maxAge === 0));
    expect(deletedByDelete || expiredBySet).toBe(true);
  });
});
