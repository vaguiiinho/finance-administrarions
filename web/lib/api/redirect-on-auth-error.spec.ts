import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? "/admin/users" : null) }) }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  }),
}));
vi.mock("next/navigation", () => nav);

import { ApiError, ForbiddenApiError, PasswordChangeRequiredApiError, UnauthenticatedApiError } from "./http";
import { redirectOnAuthError } from "./redirect-on-auth-error";

beforeEach(() => {
  nav.redirect.mockClear();
  nav.notFound.mockClear();
});

describe("redirectOnAuthError (ADR 9.4)", () => {
  it("devolve o valor quando a leitura funciona", async () => {
    expect(await redirectOnAuthError(async () => 7)).toBe(7);
  });
  it("401 -> login com next e reason=expired", async () => {
    await expect(redirectOnAuthError(async () => Promise.reject(new UnauthenticatedApiError()))).rejects.toThrow("NEXT_REDIRECT");
    expect(nav.redirect).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fusers&reason=expired");
  });
  it("403 PASSWORD_CHANGE_REQUIRED -> troca de senha com next", async () => {
    await expect(redirectOnAuthError(async () => Promise.reject(new PasswordChangeRequiredApiError()))).rejects.toThrow("NEXT_REDIRECT");
    expect(nav.redirect).toHaveBeenCalledWith("/account/password?next=%2Fadmin%2Fusers");
  });
  it("403 FORBIDDEN -> notFound", async () => {
    await expect(redirectOnAuthError(async () => Promise.reject(new ForbiddenApiError()))).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("outros erros seguem como ApiError (error boundary do bloco)", async () => {
    await expect(redirectOnAuthError(async () => Promise.reject(new ApiError(500, "INTERNAL_ERROR", "x", null)))).rejects.toMatchObject({ status: 500 });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});
