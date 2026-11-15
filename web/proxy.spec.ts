// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

// NODE_ENV=test -> cookie `fa_session` (producao usaria `__Host-fa_session`).
const COOKIE = "fa_session";
const req = (path: string, cookie?: string) => new NextRequest(`http://localhost:3100${path}`, { headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {} });
const location = (res: Response) => {
  const l = res.headers.get("location");
  return l ? new URL(l).pathname + new URL(l).search : null;
};
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("proxy.ts (ADR 9.3): visitante", () => {
  it.each([
    ["/cards", "/login?next=%2Fcards"],
    ["/account", "/login?next=%2Faccount"],
    ["/admin/users", "/login?next=%2Fadmin%2Fusers"],
    ["/dashboard?month=2026-10", "/login?next=%2Fdashboard%3Fmonth%3D2026-10"],
  ])("CA40: %s redireciona para %s", async (path, to) => {
    const res = await proxy(req(path));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(location(res)).toBe(to);
  });

  it("CA06 (RF06): / sem cookie -> /login, sem passar por /demo", async () => {
    const res = await proxy(req("/"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(location(res)).toBe("/login");
  });

  it("CA08 (RF07): rota protegida com query sem cookie -> /login?next=<caminho+query> (mantido)", async () => {
    expect(location(await proxy(req("/dashboard?month=2026-11")))).toBe("/login?next=%2Fdashboard%3Fmonth%3D2026-11");
  });

  it("rotas publicas e /register passam (o not-found global responde /register, CA07)", async () => {
    for (const p of ["/login", "/register", "/privacy", "/support"]) {
      const res = await proxy(req(p));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("CA09 (RF02): /demo/* nao e mais rota: o proxy nao redireciona (o 404 global responde), com ou sem cookie", async () => {
    for (const p of ["/demo", "/demo/entries", "/demo/dashboard", "/demo/cards"]) {
      expect((await proxy(req(p))).headers.get("location"), p).toBeNull();
      expect((await proxy(req(p, "tok"))).headers.get("location"), p).toBeNull();
    }
  });

  it("nao chama a API para visitante", async () => {
    await proxy(req("/login"));
    await proxy(req("/cards"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("proxy.ts: com cookie", () => {
  it("CA07 (RF06): / com cookie -> /entries", async () => {
    expect(location(await proxy(req("/", "tok")))).toBe("/entries");
  });

  it("injeta x-fa-url (path + query) para os layouts e readers", async () => {
    const res = await proxy(req("/cards?x=1", "tok"));
    expect(res.headers.get("x-middleware-request-x-fa-url")).toBe("/cards?x=1");
  });

  it("CA07: /login com sessao valida -> /entries (validando em GET /api/auth/me)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "u", name: "Ana", email: "a@b.c", role: "USER", mustChangePassword: false }), { status: 200 }));
    const res = await proxy(req("/login", "tok"));
    expect(location(res)).toBe("/entries");
    const [url, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/api/auth/me");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
  });

  it("CA08: /login com sessao valida e troca obrigatoria -> /account/password", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "u", name: "Carla", email: "c@b.c", role: "USER", mustChangePassword: true }), { status: 200 }));
    const res = await proxy(req("/login", "tok"));
    expect(new URL(res.headers.get("location") ?? "http://x/").pathname).toBe("/account/password");
  });

  it("/login com cookie invalido (401): segue para o login e apaga o cookie", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "UNAUTHENTICATED" }), { status: 401 }));
    const res = await proxy(req("/login", "velho"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie") ?? "").toMatch(new RegExp(`${COOKIE}=;|${COOKIE}=; |Max-Age=0|Expires=Thu, 01 Jan 1970`, "i"));
  });

  it("/login: API fora do ar (timeout/rede) nao trava a pagina de login", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    const res = await proxy(req("/login", "tok"));
    expect(res.status).toBeLessThan(500);
  });

  it("rotas protegidas com cookie seguem sem consultar a API (nivel e troca ficam no layout/API)", async () => {
    const res = await proxy(req("/admin/users", "tok"));
    expect(res.headers.get("location")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
