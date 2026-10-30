import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => cookie);
const hdrs = vi.hoisted(() => ({ url: "/cards?x=1" as string | null }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? hdrs.url : null) }) }));

import { ApiError, ForbiddenApiError, PasswordChangeRequiredApiError, UnauthenticatedApiError } from "./http";
import { toResult } from "./action-result";

beforeEach(() => {
  cookie.clearSessionCookie.mockReset();
  hdrs.url = "/cards?x=1";
});

describe("toResult (ADR 9.5, 13.2)", () => {
  it("sucesso", async () => {
    expect(await toResult(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("ApiError vira erro serializavel com fields/missingIds/incomeIds (comportamento atual preservado)", async () => {
    const r = await toResult(async () => {
      throw new ApiError(400, "VALIDATION_ERROR", "Dados inválidos.", { fields: [{ field: "name", code: "REQUIRED", message: "x" }], missingIds: ["a"], incomeIds: ["b"] });
    });
    expect(r).toEqual({ ok: false, error: { status: 400, code: "VALIDATION_ERROR", message: "Dados inválidos.", fields: [{ field: "name", code: "REQUIRED", message: "x" }], missingIds: ["a"], incomeIds: ["b"] } });
  });

  it("429 devolve retryAfterSeconds para a tela montar a mensagem", async () => {
    const r = await toResult(async () => {
      throw new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 180 });
    });
    expect(r).toMatchObject({ ok: false, error: { status: 429, code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 180 } });
  });

  it("401: apaga o cookie, SESSION_EXPIRED, mensagem unica e redirectUrl com next + reason=expired (CA06)", async () => {
    const r = await toResult(async () => {
      throw new UnauthenticatedApiError();
    });
    expect(cookie.clearSessionCookie).toHaveBeenCalledTimes(1);
    expect(r).toEqual({
      ok: false,
      error: { status: 401, code: "SESSION_EXPIRED", message: "Sua sessão expirou. Entre novamente.", redirectUrl: "/login?next=%2Fcards%3Fx%3D1&reason=expired" },
    });
  });

  it("401 sem x-fa-url: login sem next, ainda com reason=expired", async () => {
    hdrs.url = null;
    const r = await toResult(async () => {
      throw new UnauthenticatedApiError();
    });
    expect(r).toMatchObject({ ok: false, error: { code: "SESSION_EXPIRED" } });
    const url = (r as { error: { redirectUrl?: string } }).error.redirectUrl ?? "";
    expect(url.startsWith("/login")).toBe(true);
    expect(url).toContain("reason=expired");
  });

  it("403 PASSWORD_CHANGE_REQUIRED: redirectUrl para a troca, com next = tela atual; NAO apaga o cookie", async () => {
    const r = await toResult(async () => {
      throw new PasswordChangeRequiredApiError();
    });
    expect(cookie.clearSessionCookie).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: false, error: { status: 403, code: "PASSWORD_CHANGE_REQUIRED" } });
    const to = (r as { error: { redirectUrl?: string } }).error.redirectUrl ?? "";
    const u = new URL(to, "http://x");
    expect(u.pathname).toBe("/account/password");
    expect(u.searchParams.get("next")).toBe("/cards?x=1");
  });

  it("403 FORBIDDEN fica como erro comum, sem redirectUrl", async () => {
    const r = await toResult(async () => {
      throw new ForbiddenApiError();
    });
    expect(r).toMatchObject({ ok: false, error: { status: 403, code: "FORBIDDEN" } });
    expect((r as { error: { redirectUrl?: string } }).error.redirectUrl).toBeUndefined();
  });

  it("erro desconhecido vira 500 generico sem vazar a mensagem", async () => {
    const r = await toResult(async () => {
      throw new Error("segredo interno");
    });
    expect(r).toEqual({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "Erro inesperado." } });
  });
});
