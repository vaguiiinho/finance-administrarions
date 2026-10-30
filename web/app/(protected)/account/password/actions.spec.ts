import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, redirectMock, target } from "@/test/helpers/action-env";

vi.mock("server-only", () => ({}));
const identity = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock("@/lib/api/identity-client", () => identity);
const cookie = vi.hoisted(() => ({ writeSessionCookie: vi.fn(), clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => cookie);
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), redirect: redirectMock }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? "/account/password" : null) }) }));

import { ApiError } from "@/lib/api/http";
import { INITIAL_FORM_STATE } from "@/lib/auth/form-state";
import { changePasswordAction } from "./actions";

const ANA = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false };
const valid = { currentPassword: "Temp1234", newPassword: "MinhaSenha9", confirmPassword: "MinhaSenha9" };
const run = (values: Record<string, string>) => changePasswordAction(INITIAL_FORM_STATE, form(values));
const fieldError = (field: string, code: string) => new ApiError(400, "VALIDATION_ERROR", "x", { fields: [{ field, code, message: "x" }] });

beforeEach(() => {
  identity.changePassword.mockReset().mockResolvedValue(ANA);
  cookie.writeSessionCookie.mockReset();
  cookie.clearSessionCookie.mockReset();
  cache.revalidatePath.mockReset();
  redirectMock.mockClear();
});

describe("changePasswordAction: confirmacao no web (CA10, RF08)", () => {
  it("confirmacao diferente: 'As senhas nao conferem.' em confirmPassword e a API NAO e chamada", async () => {
    const state = await run({ ...valid, confirmPassword: "outra", mode: "optional" });
    expect(state).toMatchObject({ status: "error", fields: { confirmPassword: "As senhas não conferem." } });
    expect(identity.changePassword).not.toHaveBeenCalled();
  });

  it("a confirmacao nunca e enviada a API", async () => {
    await run({ ...valid, mode: "optional" });
    expect(identity.changePassword).toHaveBeenCalledWith("Temp1234", "MinhaSenha9");
  });
});

describe("changePasswordAction: erros da API viram mensagens de campo (CA10)", () => {
  it.each([
    ["currentPassword", "INCORRECT", "Senha atual incorreta."],
    ["newPassword", "SAME_AS_CURRENT", "A nova senha deve ser diferente da atual."],
    ["newPassword", "TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
    ["newPassword", "TOO_LONG", "A senha pode ter no máximo 72 caracteres."],
    ["currentPassword", "REQUIRED", "Informe a senha atual."],
  ])("%s %s", async (field, code, message) => {
    identity.changePassword.mockRejectedValue(fieldError(field, code));
    const state = await run({ ...valid, mode: "optional" });
    expect(state).toMatchObject({ status: "error", fields: { [field]: message } });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("429 (6a senha atual errada): retryAfterSeconds no estado", async () => {
    identity.changePassword.mockRejectedValue(new ApiError(429, "TOO_MANY_ATTEMPTS", "x", { retryAfterSeconds: 120 }));
    expect(await run({ ...valid, mode: "optional" })).toMatchObject({ status: "error", code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 120 });
  });

  it("rede: estado de erro sem lancar", async () => {
    identity.changePassword.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x", null));
    expect(await run({ ...valid, mode: "optional" })).toMatchObject({ status: "error", code: "NETWORK_ERROR" });
  });

  it("401: SESSION_EXPIRED com redirectUrl de login (design 8)", async () => {
    identity.changePassword.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "x", null));
    const state = await run({ ...valid, mode: "optional" });
    expect(state).toMatchObject({ status: "error", code: "SESSION_EXPIRED", message: "Sua sessão expirou. Entre novamente." });
    expect(state.redirectUrl).toContain("/login");
    expect(state.redirectUrl).toContain("reason=expired");
  });
});

describe("changePasswordAction: sucesso (CA09, RF08)", () => {
  it("modo obrigatorio: vai para o next preservado e revalida o layout (navbar/menu/footer voltam ao modo completo)", async () => {
    await expect(run({ ...valid, mode: "required", next: "/cards" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(target(redirectMock.mock.calls[0][0]).pathname).toBe("/cards");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/", "layout");
    const revalidatedBeforeRedirect = cache.revalidatePath.mock.invocationCallOrder[0] < redirectMock.mock.invocationCallOrder[0];
    expect(revalidatedBeforeRedirect).toBe(true);
  });

  it("modo obrigatorio com next malicioso ou ausente -> /entries", async () => {
    await expect(run({ ...valid, mode: "required", next: "//evil.com" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenLastCalledWith("/entries");
    await expect(run({ ...valid, mode: "required" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenLastCalledWith("/entries");
  });

  it("modo opcional: nao redireciona; estado 'Senha alterada.' (o next e ignorado)", async () => {
    const state = await run({ ...valid, mode: "optional", next: "/cards" });
    expect(state).toMatchObject({ status: "success", message: "Senha alterada." });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("a sessao atual e mantida: o cookie nao e apagado nem regravado", async () => {
    await run({ ...valid, mode: "optional" });
    expect(cookie.clearSessionCookie).not.toHaveBeenCalled();
  });

  it("senhas nao voltam no estado de sucesso", async () => {
    const state = await run({ ...valid, mode: "optional" });
    expect(JSON.stringify(state)).not.toMatch(/MinhaSenha9|Temp1234/);
  });
});
