import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ readSessionToken: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => session);
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));

import * as identity from "./identity-client";

const ID = "0192f1e2-0000-7000-8000-000000000001";
const EVIL = "../admin/users/x";
const fetchMock = vi.fn();
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
  return { url: new URL(String(url)), method: init.method, headers: new Headers(init?.headers), body: init.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  session.readSessionToken.mockReset().mockResolvedValue("tok-abc");
});

describe("identity-client: A1-A5 (ADR 6.2)", () => {
  it("A1 login: POST /api/auth/login SEM Bearer", async () => {
    await identity.login("ana@exemplo.com", "segredo123");
    const s = sent();
    expect([s.method, s.url.pathname]).toEqual(["POST", "/api/auth/login"]);
    expect(s.headers.get("authorization")).toBeNull();
    expect(s.body).toEqual({ email: "ana@exemplo.com", password: "segredo123" });
  });
  it("A2 logout: POST /api/auth/logout com o Bearer", async () => {
    await identity.logout();
    expect([sent().method, sent().url.pathname]).toEqual(["POST", "/api/auth/logout"]);
    expect(sent().headers.get("authorization")).toBe("Bearer tok-abc");
  });
  it("A3 me: GET /api/auth/me", async () => {
    await identity.fetchMe();
    expect([sent().method, sent().url.pathname]).toEqual(["GET", "/api/auth/me"]);
  });
  it("A4: PUT /api/account/password so com currentPassword e newPassword (a confirmacao nunca vai a API)", async () => {
    await identity.changePassword("Temp1234", "MinhaSenha9");
    expect([sent().method, sent().url.pathname]).toEqual(["PUT", "/api/account/password"]);
    expect(sent().body).toEqual({ currentPassword: "Temp1234", newPassword: "MinhaSenha9" });
  });
  it("A5: PUT /api/account/profile so com name", async () => {
    await identity.updateProfile("ana lima");
    expect([sent().method, sent().url.pathname]).toEqual(["PUT", "/api/account/profile"]);
    expect(sent().body).toEqual({ name: "ana lima" });
  });
});

describe("identity-client: U1-U7 (gestao)", () => {
  it("U1 lista", async () => {
    await identity.listUsers();
    expect([sent().method, sent().url.pathname]).toEqual(["GET", "/api/admin/users"]);
  });
  it("U3 cria: corpo name/email/role/password", async () => {
    await identity.createUser({ name: "Carla Dias", email: "carla@exemplo.com", role: "USER", password: "Temp1234" });
    expect([sent().method, sent().url.pathname]).toEqual(["POST", "/api/admin/users"]);
    expect(sent().body).toEqual({ name: "Carla Dias", email: "carla@exemplo.com", role: "USER", password: "Temp1234" });
  });
  it("U4 edita: PUT sem senha", async () => {
    await identity.updateUser(ID, { name: "Ana Lima", email: "ana.lima@exemplo.com", role: "ADMIN" });
    expect([sent().method, sent().url.pathname]).toEqual(["PUT", `/api/admin/users/${ID}`]);
    expect(sent().body).not.toHaveProperty("password");
  });
  it.each([
    ["deactivateUser", "/deactivate"],
    ["reactivateUser", "/reactivate"],
  ] as const)("U5/U6 %s: POST %s", async (fn, suffix) => {
    await identity[fn](ID);
    expect([sent().method, sent().url.pathname]).toEqual(["POST", `/api/admin/users/${ID}${suffix}`]);
  });
  it("U7 redefinir senha: POST /password-reset com { password }", async () => {
    await identity.resetUserPassword(ID, "Nova1234");
    expect([sent().method, sent().url.pathname]).toEqual(["POST", `/api/admin/users/${ID}/password-reset`]);
    expect(sent().body).toEqual({ password: "Nova1234" });
  });
  it("ids sao codificados (anti path injection)", async () => {
    await identity.deactivateUser(EVIL);
    expect(sent().url.pathname).not.toContain("../");
    expect(sent().url.pathname).toContain(encodeURIComponent(EVIL));
  });
});
