import { beforeEach, describe, expect, it, vi } from "vitest";

// CA06 / ADR 9.5 "Escritas existentes": as Server Actions de escrita (hoje em (app)/, depois (protected)/) tratam 401 e 403 PCR.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const ep = vi.hoisted(() => ({ createCardRequest: vi.fn(), updateCardRequest: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ep);
const cookie = vi.hoisted(() => ({ clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => cookie);
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? "/cards" : null) }) }));

import { PasswordChangeRequiredApiError, UnauthenticatedApiError } from "@/lib/api/http";
import { createCard } from "./actions";

beforeEach(() => {
  ep.createCardRequest.mockReset();
  cookie.clearSessionCookie.mockReset();
});

describe("createCard com sessao invalida (CA06, CA08)", () => {
  it("401 -> SESSION_EXPIRED com redirectUrl de login e cookie apagado; nada e criado", async () => {
    ep.createCardRequest.mockRejectedValue(new UnauthenticatedApiError());
    const r = await createCard({ name: "Nubank", closingDay: 25, dueDay: 5 });
    expect(r).toMatchObject({ ok: false, error: { status: 401, code: "SESSION_EXPIRED", message: "Sua sessão expirou. Entre novamente." } });
    expect((r as { error: { redirectUrl?: string } }).error.redirectUrl).toContain("/login");
    expect(cookie.clearSessionCookie).toHaveBeenCalled();
  });

  it("403 PASSWORD_CHANGE_REQUIRED -> redirectUrl para /account/password", async () => {
    ep.createCardRequest.mockRejectedValue(new PasswordChangeRequiredApiError());
    const r = await createCard({ name: "Nubank", closingDay: 25, dueDay: 5 });
    expect(r).toMatchObject({ ok: false, error: { code: "PASSWORD_CHANGE_REQUIRED" } });
    expect((r as { error: { redirectUrl?: string } }).error.redirectUrl).toContain("/account/password");
  });
});
