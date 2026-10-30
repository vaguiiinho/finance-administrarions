import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ readSessionToken: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => session);
const hdrs = vi.hoisted(() => ({ map: new Map<string, string>() }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => hdrs.map.get(k.toLowerCase()) ?? null }) }));

import { ApiError, ForbiddenApiError, PasswordChangeRequiredApiError, UnauthenticatedApiError, apiGet, apiPost, request } from "./http";

const fetchMock = vi.fn();
const reply = (status: number, body?: unknown) => fetchMock.mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
  const headers = new Headers(init?.headers);
  return { url: String(url), init, headers };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  session.readSessionToken.mockReset().mockResolvedValue("tok-abc");
  hdrs.map = new Map();
});

describe("http.ts: Bearer, X-Forwarded-For e erros tipados (ADR 9.2)", () => {
  it("envia Authorization: Bearer <cookie> e cache no-store", async () => {
    reply(200, { ok: 1 });
    await apiGet("/summary", { month: "2026-10" });
    const { url, init, headers } = sent();
    expect(url).toContain("/api/summary?month=2026-10");
    expect(headers.get("authorization")).toBe("Bearer tok-abc");
    expect(init.cache).toBe("no-store");
  });

  it("POST com corpo mantem content-type JSON e o Bearer", async () => {
    reply(200, {});
    await apiPost("/entries/pay", { ids: ["a"] });
    const { headers, init } = sent();
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer tok-abc");
    expect(init.body).toBe(JSON.stringify({ ids: ["a"] }));
  });

  it("sem cookie, NAO chama a API e lanca UnauthenticatedApiError", async () => {
    session.readSessionToken.mockResolvedValue(undefined);
    await expect(apiGet("/summary", { month: "2026-10" })).rejects.toBeInstanceOf(UnauthenticatedApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("auth 'none' (login, demo) nao envia Bearer mesmo havendo cookie e funciona sem cookie", async () => {
    reply(200, {});
    await request("POST", "/auth/login", { body: { email: "a@b.c", password: "x" }, auth: "none" });
    expect(sent().headers.get("authorization")).toBeNull();
    fetchMock.mockClear();
    session.readSessionToken.mockResolvedValue(undefined);
    reply(200, {});
    await request("GET", "/demo/summary", { query: { month: "2026-10" }, auth: "none" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().headers.get("authorization")).toBeNull();
  });

  it("repassa o IP do cliente em X-Forwarded-For (rate limit por IP, RNF04)", async () => {
    hdrs.map.set("x-forwarded-for", "203.0.113.7");
    reply(200, {});
    await apiGet("/summary", { month: "2026-10" });
    expect(sent().headers.get("x-forwarded-for")?.split(",")[0].trim()).toBe("203.0.113.7");
  });

  it("sem X-Forwarded-For de entrada nao inventa um valor", async () => {
    reply(200, {});
    await apiGet("/summary", { month: "2026-10" });
    const xff = sent().headers.get("x-forwarded-for");
    expect(xff === null || xff.length > 0).toBe(true);
  });

  it("401 -> UnauthenticatedApiError (e continua sendo ApiError)", async () => {
    reply(401, { code: "UNAUTHENTICATED", message: "x" });
    const error = (await apiGet("/summary").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(UnauthenticatedApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
  });

  it("403 PASSWORD_CHANGE_REQUIRED -> PasswordChangeRequiredApiError", async () => {
    reply(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "x" });
    await expect(apiGet("/summary")).rejects.toBeInstanceOf(PasswordChangeRequiredApiError);
  });

  it("403 FORBIDDEN -> ForbiddenApiError", async () => {
    reply(403, { code: "FORBIDDEN", message: "x" });
    await expect(apiGet("/admin/users")).rejects.toBeInstanceOf(ForbiddenApiError);
  });

  it("404, 409, 422 e 429 continuam ApiError simples, com code/details preservados", async () => {
    reply(429, { code: "TOO_MANY_ATTEMPTS", message: "x", details: { retryAfterSeconds: 180 } });
    const error = await request("POST", "/auth/login", { body: {}, auth: "none" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(UnauthenticatedApiError);
    expect(error).toMatchObject({ status: 429, code: "TOO_MANY_ATTEMPTS", details: { retryAfterSeconds: 180 } });
  });

  it("falha de rede vira ApiError NETWORK_ERROR (status 0), nao UnauthenticatedApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const error = (await apiGet("/summary").catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect(error).not.toBeInstanceOf(UnauthenticatedApiError);
  });

  it("204 sem corpo (logout) nao quebra", async () => {
    reply(204);
    await expect(request("POST", "/auth/logout", { auth: "none" })).resolves.toBeUndefined();
  });
});
