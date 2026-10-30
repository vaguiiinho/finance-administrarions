import { beforeEach, describe, expect, it, vi } from "vitest";
import { form } from "@/test/helpers/action-env";

vi.mock("server-only", () => ({}));
const identity = vi.hoisted(() => ({ updateProfile: vi.fn() }));
vi.mock("@/lib/api/identity-client", () => identity);
vi.mock("@/lib/auth/session-cookie", () => ({ clearSessionCookie: vi.fn(), writeSessionCookie: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? "/account" : null) }) }));

import { ApiError } from "@/lib/api/http";
import { INITIAL_FORM_STATE } from "@/lib/auth/form-state";
import { updateProfileAction } from "./actions";

const run = (name: string) => updateProfileAction(INITIAL_FORM_STATE, form({ name }));

beforeEach(() => {
  identity.updateProfile.mockReset();
  cache.revalidatePath.mockReset();
});

describe("updateProfileAction (RF09, CA11)", () => {
  it("CA11: envia so o nome; o valor normalizado da API volta no estado e o layout e revalidado (inicial da navbar)", async () => {
    identity.updateProfile.mockResolvedValue({ id: "u1", name: "ana lima", email: "ana@exemplo.com", role: "USER", mustChangePassword: false });
    const state = await run("  ana   lima ");
    expect(identity.updateProfile).toHaveBeenCalledWith("  ana   lima ");
    expect(state).toMatchObject({ status: "success", values: { name: "ana lima" } });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each([
    ["REQUIRED", "Informe seu nome."],
    ["TOO_LONG", "Use até 60 caracteres."],
  ])("400 name %s -> %s e nada e revalidado", async (code, message) => {
    identity.updateProfile.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "x", { fields: [{ field: "name", code, message: "x" }] }));
    const state = await run("");
    expect(state).toMatchObject({ status: "error", fields: { name: message } });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("rede/5xx: erro geral, e o valor digitado volta para a tela preservar", async () => {
    identity.updateProfile.mockRejectedValue(new ApiError(503, "INTERNAL_ERROR", "x", null));
    expect(await run("Ana")).toMatchObject({ status: "error", values: { name: "Ana" } });
  });

  it("401 -> SESSION_EXPIRED + redirectUrl; 403 PCR -> redirectUrl para a troca", async () => {
    identity.updateProfile.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "x", null));
    expect(await run("Ana")).toMatchObject({ status: "error", code: "SESSION_EXPIRED" });
    identity.updateProfile.mockRejectedValue(new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "x", null));
    const s = await run("Ana");
    expect(s).toMatchObject({ status: "error", code: "PASSWORD_CHANGE_REQUIRED" });
    expect(s.redirectUrl).toContain("/account/password");
  });
});
