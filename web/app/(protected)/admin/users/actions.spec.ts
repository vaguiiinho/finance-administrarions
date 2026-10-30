import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const identity = vi.hoisted(() => ({ createUser: vi.fn(), updateUser: vi.fn(), deactivateUser: vi.fn(), reactivateUser: vi.fn(), resetUserPassword: vi.fn() }));
vi.mock("@/lib/api/identity-client", () => identity);
const cookie = vi.hoisted(() => ({ clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => cookie);
const me = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => me);
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? "/admin/users" : null) }) }));

import { ApiError } from "@/lib/api/http";
import type { AdminUserDto } from "@/lib/api/types";
import { createUserAction, deactivateUserAction, reactivateUserAction, resetUserPasswordAction, updateUserAction } from "./actions";

const ID = "0192f1e2-0000-7000-8000-000000000001";
const EVIL = "../x";
const user = (over: Partial<AdminUserDto> = {}): AdminUserDto => ({ id: ID, name: "Ana Souza", email: "ana@exemplo.com", role: "USER", status: "ACTIVE", mustChangePassword: false, createdAt: "2026-10-29T12:00:00.000Z", ...over });
const fields = (...f: [string, string][]) => new ApiError(400, "VALIDATION_ERROR", "x", { fields: f.map(([field, code]) => ({ field, code, message: "x" })) });

beforeEach(() => {
  Object.values(identity).forEach((f) => f.mockReset());
  cookie.clearSessionCookie.mockReset();
  cache.revalidatePath.mockReset();
  me.getCurrentUser.mockReset().mockResolvedValue({ id: "0192f1e2-0000-7000-8000-0000000000aa", name: "Vagner", email: "v@e.c", role: "ADMIN", mustChangePassword: false });
});

describe("createUserAction (RF12, CA16-CA18)", () => {
  it("sucesso: devolve o usuario e revalida a lista; a senha temporaria nao volta", async () => {
    identity.createUser.mockResolvedValue(user({ name: "Carla Dias", email: "carla@exemplo.com", mustChangePassword: true }));
    const r = await createUserAction({ name: "  Carla   Dias ", email: " Carla@Exemplo.com ", role: "USER", password: "Temp1234" });
    expect(identity.createUser).toHaveBeenCalledWith({ name: "  Carla   Dias ", email: " Carla@Exemplo.com ", role: "USER", password: "Temp1234" });
    expect(r).toMatchObject({ ok: true, data: { name: "Carla Dias", mustChangePassword: true } });
    expect(JSON.stringify(r)).not.toContain("Temp1234");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("CA18: 400 acumulado preserva os quatro campos para a tela", async () => {
    identity.createUser.mockRejectedValue(fields(["name", "REQUIRED"], ["email", "INVALID_FORMAT"], ["role", "INVALID_VALUE"], ["password", "TOO_SHORT"]));
    const r = await createUserAction({ name: "", email: "ana@", role: "ROOT", password: "1234567" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fields?.map((f) => `${f.field}:${f.code}`)).toEqual(["name:REQUIRED", "email:INVALID_FORMAT", "role:INVALID_VALUE", "password:TOO_SHORT"]);
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("CA17: 409 EMAIL_TAKEN com fields[0] no campo email", async () => {
    identity.createUser.mockRejectedValue(new ApiError(409, "EMAIL_TAKEN", "x", { fields: [{ field: "email", code: "EMAIL_TAKEN", message: "x" }] }));
    expect(await createUserAction({ name: "A", email: "ana@exemplo.com", role: "USER", password: "Temp1234" })).toMatchObject({ ok: false, error: { status: 409, code: "EMAIL_TAKEN", fields: [{ field: "email", code: "EMAIL_TAKEN" }] } });
  });

  it("401 -> SESSION_EXPIRED com redirectUrl; 403 PCR -> redirectUrl; 403 FORBIDDEN fica FORBIDDEN (a tela faz refresh)", async () => {
    identity.createUser.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "x", null));
    expect(await createUserAction({ name: "A", email: "a@b.c", role: "USER", password: "Temp1234" })).toMatchObject({ ok: false, error: { code: "SESSION_EXPIRED" } });
    identity.createUser.mockRejectedValue(new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "x", null));
    expect(await createUserAction({ name: "A", email: "a@b.c", role: "USER", password: "Temp1234" })).toMatchObject({ ok: false, error: { code: "PASSWORD_CHANGE_REQUIRED" } });
    identity.createUser.mockRejectedValue(new ApiError(403, "FORBIDDEN", "x", null));
    expect(await createUserAction({ name: "A", email: "a@b.c", role: "USER", password: "Temp1234" })).toMatchObject({ ok: false, error: { status: 403, code: "FORBIDDEN" } });
  });
});

describe("updateUserAction (RF13, CA19, CA24, PA7)", () => {
  it("sucesso sobre outro usuario: selfDemoted=false", async () => {
    identity.updateUser.mockResolvedValue(user({ name: "Ana Lima", role: "ADMIN" }));
    const r = await updateUserAction(ID, { name: "Ana Lima", email: "ana.lima@exemplo.com", role: "ADMIN" });
    expect(identity.updateUser).toHaveBeenCalledWith(ID, { name: "Ana Lima", email: "ana.lima@exemplo.com", role: "ADMIN" });
    expect(r).toMatchObject({ ok: true, data: { selfDemoted: false, user: { name: "Ana Lima" } } });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("PA7: o ator editando a si mesmo para USER -> selfDemoted=true e o layout inteiro e revalidado", async () => {
    me.getCurrentUser.mockResolvedValue({ id: ID, name: "Vagner", email: "v@e.c", role: "ADMIN", mustChangePassword: false });
    identity.updateUser.mockResolvedValue(user({ id: ID, role: "USER" }));
    const r = await updateUserAction(ID, { name: "Vagner", email: "v@e.c", role: "USER" });
    expect(r).toMatchObject({ ok: true, data: { selfDemoted: true } });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("editando a si mesmo mantendo ADMIN: selfDemoted=false", async () => {
    me.getCurrentUser.mockResolvedValue({ id: ID, name: "Vagner", email: "v@e.c", role: "ADMIN", mustChangePassword: false });
    identity.updateUser.mockResolvedValue(user({ id: ID, role: "ADMIN" }));
    expect(await updateUserAction(ID, { name: "Vagner", email: "v@e.c", role: "ADMIN" })).toMatchObject({ ok: true, data: { selfDemoted: false } });
  });

  it("CA24: 422 LAST_ADMIN e 404 USER_NOT_FOUND chegam intactos", async () => {
    identity.updateUser.mockRejectedValue(new ApiError(422, "LAST_ADMIN", "x", { fields: [{ field: "role", code: "LAST_ADMIN", message: "x" }] }));
    expect(await updateUserAction(ID, { name: "V", email: "v@e.c", role: "USER" })).toMatchObject({ ok: false, error: { status: 422, code: "LAST_ADMIN" } });
    identity.updateUser.mockRejectedValue(new ApiError(404, "USER_NOT_FOUND", "x", null));
    expect(await updateUserAction(ID, { name: "V", email: "v@e.c", role: "USER" })).toMatchObject({ ok: false, error: { status: 404, code: "USER_NOT_FOUND" } });
  });
});

describe("deactivate / reactivate / reset (RF14-RF16, CA20-CA23)", () => {
  it("inativar: chama U5 e revalida", async () => {
    identity.deactivateUser.mockResolvedValue(user({ status: "INACTIVE" }));
    expect(await deactivateUserAction(ID)).toMatchObject({ ok: true, data: { status: "INACTIVE" } });
    expect(identity.deactivateUser).toHaveBeenCalledWith(ID);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
  it.each([
    ["LAST_ADMIN", "É preciso manter pelo menos um administrador ativo."],
    ["CANNOT_TARGET_SELF", "Você não pode executar esta ação na sua própria conta."],
  ])("inativar 422 %s", async (code) => {
    identity.deactivateUser.mockRejectedValue(new ApiError(422, code, "x", null));
    expect(await deactivateUserAction(ID)).toMatchObject({ ok: false, error: { status: 422, code } });
  });
  it("reativar: chama U6 e revalida", async () => {
    identity.reactivateUser.mockResolvedValue(user());
    expect(await reactivateUserAction(ID)).toMatchObject({ ok: true });
    expect(identity.reactivateUser).toHaveBeenCalledWith(ID);
  });
  it("redefinir: chama U7 com a senha temporaria; a senha nao volta; 422 CANNOT_TARGET_SELF chega intacto", async () => {
    identity.resetUserPassword.mockResolvedValue(user({ mustChangePassword: true }));
    const r = await resetUserPasswordAction(ID, { password: "Nova1234" });
    expect(identity.resetUserPassword).toHaveBeenCalledWith(ID, "Nova1234");
    expect(r).toMatchObject({ ok: true, data: { mustChangePassword: true } });
    expect(JSON.stringify(r)).not.toContain("Nova1234");
    identity.resetUserPassword.mockRejectedValue(new ApiError(422, "CANNOT_TARGET_SELF", "x", null));
    expect(await resetUserPasswordAction(ID, { password: "Nova1234" })).toMatchObject({ ok: false, error: { code: "CANNOT_TARGET_SELF" } });
  });
  it("400 da senha temporaria (TOO_SHORT) preserva o campo", async () => {
    identity.resetUserPassword.mockRejectedValue(fields(["password", "TOO_SHORT"]));
    expect(await resetUserPasswordAction(ID, { password: "123" })).toMatchObject({ ok: false, error: { fields: [{ field: "password", code: "TOO_SHORT" }] } });
  });
});

describe("validacao de id antes de chamar a API (anti path injection)", () => {
  it.each([
    ["updateUserAction", () => updateUserAction(EVIL, { name: "a", email: "a@b.c", role: "USER" })],
    ["deactivateUserAction", () => deactivateUserAction(EVIL)],
    ["reactivateUserAction", () => reactivateUserAction(EVIL)],
    ["resetUserPasswordAction", () => resetUserPasswordAction(EVIL, { password: "Nova1234" })],
  ])("%s rejeita id fora do formato UUID com 400 e nao chama a API", async (_n, call) => {
    expect(await call()).toMatchObject({ ok: false, error: { status: 400 } });
    for (const f of Object.values(identity)) expect(f).not.toHaveBeenCalled();
  });
});
