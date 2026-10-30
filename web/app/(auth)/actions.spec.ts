import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, redirectMock, target } from "@/test/helpers/action-env";

vi.mock("server-only", () => ({}));
const identity = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/api/identity-client", () => identity);
const cookie = vi.hoisted(() => ({ writeSessionCookie: vi.fn(), clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => cookie);
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }), cookies: async () => ({ get: () => undefined }) }));

import { ApiError } from "@/lib/api/http";
import { INITIAL_FORM_STATE } from "@/lib/auth/form-state";
import { loginAction, logoutAction } from "./actions";

const SESSION = { token: "tok-1", expiresAt: "2026-11-02T13:00:00.000Z" };
const ANA = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false };
const run = (values: Record<string, string>) => loginAction(INITIAL_FORM_STATE, form(values));
const redirected = async (values: Record<string, string>) => {
  await expect(run(values)).rejects.toThrow(/NEXT_REDIRECT/);
  return target(redirectMock.mock.calls.at(-1)?.[0] as string);
};

beforeEach(() => {
  identity.login.mockReset();
  identity.logout.mockReset().mockResolvedValue(undefined);
  cookie.writeSessionCookie.mockReset();
  cookie.clearSessionCookie.mockReset();
  redirectMock.mockClear();
});

describe("loginAction: sucesso (CA01, CA02, CA08)", () => {
  it("CA01: grava o cookie com token e validade da sessao e redireciona para o next", async () => {
    identity.login.mockResolvedValue({ user: ANA, session: SESSION });
    const to = await redirected({ email: "ana@exemplo.com", password: "segredo123", next: "/cards" });
    expect(identity.login).toHaveBeenCalledWith("ana@exemplo.com", "segredo123");
    expect(cookie.writeSessionCookie).toHaveBeenCalledWith(SESSION);
    expect(to.pathname).toBe("/cards");
  });

  it("mantem a query do next (ex.: /dashboard?month=2026-10)", async () => {
    identity.login.mockResolvedValue({ user: ANA, session: SESSION });
    await expect(run({ email: "a@b.c", password: "x", next: "/dashboard?month=2026-10" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/dashboard?month=2026-10");
  });

  it.each(["//evil.com", "https://evil.com", "/demo/entries", "", "/\\evil.com"])("CA02: next=%j -> /entries", async (next) => {
    identity.login.mockResolvedValue({ user: ANA, session: SESSION });
    await expect(run({ email: "a@b.c", password: "x", next })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/entries");
  });

  it("sem next -> /entries", async () => {
    identity.login.mockResolvedValue({ user: ANA, session: SESSION });
    await expect(run({ email: "a@b.c", password: "x" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/entries");
  });

  it("CA08: troca obrigatoria -> /account/password?next=<next seguro>", async () => {
    identity.login.mockResolvedValue({ user: { ...ANA, mustChangePassword: true }, session: SESSION });
    const to = await redirected({ email: "carla@exemplo.com", password: "Temp1234", next: "/cards" });
    expect(cookie.writeSessionCookie).toHaveBeenCalled();
    expect(to).toMatchObject({ pathname: "/account/password", next: "/cards" });
  });

  it("CA08 + CA02: next malicioso na troca obrigatoria tambem cai em /entries", async () => {
    identity.login.mockResolvedValue({ user: { ...ANA, mustChangePassword: true }, session: SESSION });
    const to = await redirected({ email: "c@b.c", password: "x", next: "//evil.com" });
    expect(to).toMatchObject({ pathname: "/account/password", next: "/entries" });
  });
});

describe("loginAction: erros viram estado (RF41, CA03, CA04)", () => {
  it("CA03: 401 INVALID_CREDENTIALS -> banner, e-mail preservado, sem cookie, sem redirect", async () => {
    identity.login.mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.", null));
    const state = await run({ email: "ana@exemplo.com", password: "errada", next: "/cards" });
    expect(state).toMatchObject({ status: "error", code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos.", values: { email: "ana@exemplo.com" } });
    expect(JSON.stringify(state)).not.toContain("errada");
    expect(cookie.writeSessionCookie).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("CA04: 429 -> TOO_MANY_ATTEMPTS com retryAfterSeconds; senha nao volta no estado", async () => {
    identity.login.mockRejectedValue(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 180 }));
    const state = await run({ email: "ana@exemplo.com", password: "segredo123" });
    expect(state).toMatchObject({ status: "error", code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 180 });
    expect(cookie.writeSessionCookie).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR (REQUIRED) vira erros de campo com as mensagens do design", async () => {
    identity.login.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "x", { fields: [{ field: "email", code: "REQUIRED", message: "x" }, { field: "password", code: "REQUIRED", message: "x" }] }),
    );
    const state = await run({ email: "", password: "" });
    expect(state.fields).toEqual({ email: "Informe o e-mail.", password: "Informe a senha." });
  });

  it("rede ou 5xx -> banner generico de falha, sem lancar", async () => {
    identity.login.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x", null));
    expect(await run({ email: "a@b.c", password: "x" })).toMatchObject({ status: "error", code: "NETWORK_ERROR" });
    identity.login.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    expect(await run({ email: "a@b.c", password: "x" })).toMatchObject({ status: "error" });
  });

  it("erro inesperado (nao ApiError) tambem vira estado, nao excecao", async () => {
    identity.login.mockRejectedValue(new Error("boom"));
    expect(await run({ email: "a@b.c", password: "x" })).toMatchObject({ status: "error" });
  });
});

describe("logoutAction (RF02, CA05, RNF08)", () => {
  it("chama a API, apaga o cookie e redireciona para /demo/entries", async () => {
    await expect(logoutAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(identity.logout).toHaveBeenCalledTimes(1);
    expect(cookie.clearSessionCookie).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/demo/entries");
  });

  it("ignora falha da API: o cookie e SEMPRE apagado", async () => {
    identity.logout.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    await expect(logoutAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(cookie.clearSessionCookie).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/demo/entries");
  });

  it("ignora 401 (sessao ja encerrada)", async () => {
    identity.logout.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "x", null));
    await expect(logoutAction()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(cookie.clearSessionCookie).toHaveBeenCalled();
  });
});
