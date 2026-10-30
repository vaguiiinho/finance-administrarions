import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ readSessionToken: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => session);
const hdrs = vi.hoisted(() => ({ url: "/dashboard?month=2026-10" as string | null }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => (k.toLowerCase() === "x-fa-url" ? hdrs.url : null) }) }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  }),
}));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), ...nav }));

import { createFinanceReader } from "./finance-reader";

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const sent = (i = 0) => {
  const [url, init] = fetchMock.mock.calls[i] as [URL | string, RequestInit];
  return { url: new URL(String(url)), headers: new Headers(init?.headers) };
};
const redirectedTo = () => nav.redirect.mock.calls[0]?.[0] as string | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  nav.redirect.mockClear();
  nav.notFound.mockClear();
  session.readSessionToken.mockReset().mockResolvedValue("tok-abc");
  hdrs.url = "/dashboard?month=2026-10";
});

describe("FinanceReader protegido (ADR 9.4)", () => {
  it("le /api/* com o Bearer da sessao", async () => {
    reply(200, { month: "2026-10", totals: {} });
    await createFinanceReader("protected").getSummary("2026-10");
    expect(sent().url.pathname).toBe("/api/summary");
    expect(sent().url.searchParams.get("month")).toBe("2026-10");
    expect(sent().headers.get("authorization")).toBe("Bearer tok-abc");
  });

  it("401 -> redirect para o login com next = x-fa-url e reason=expired (PA1, CA06)", async () => {
    reply(401, { code: "UNAUTHENTICATED", message: "x" });
    await expect(createFinanceReader("protected").getSummary("2026-10")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectedTo()).toBe("/login?next=%2Fdashboard%3Fmonth%3D2026-10&reason=expired");
  });

  it("sem cookie tambem vira redirect de login (nao chama a API)", async () => {
    session.readSessionToken.mockResolvedValue(undefined);
    await expect(createFinanceReader("protected").listCards()).rejects.toThrow("NEXT_REDIRECT");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirectedTo()).toContain("/login");
  });

  it("403 PASSWORD_CHANGE_REQUIRED -> redirect para /account/password?next=<url atual> (CA08)", async () => {
    reply(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "x" });
    await expect(createFinanceReader("protected").listCards()).rejects.toThrow("NEXT_REDIRECT");
    const u = new URL(redirectedTo() ?? "", "http://x");
    expect(u.pathname).toBe("/account/password");
    expect(u.searchParams.get("next")).toBe("/dashboard?month=2026-10");
  });

  it("403 FORBIDDEN -> notFound()", async () => {
    reply(403, { code: "FORBIDDEN", message: "x" });
    await expect(createFinanceReader("protected").listCards()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(nav.notFound).toHaveBeenCalledTimes(1);
  });

  it("outros erros (500, 404 de id) continuam ApiError para o error.tsx/settle tratar", async () => {
    reply(500, { code: "INTERNAL_ERROR", message: "x" });
    await expect(createFinanceReader("protected").listCards()).rejects.toMatchObject({ status: 500 });
    expect(nav.redirect).not.toHaveBeenCalled();
    expect(nav.notFound).not.toHaveBeenCalled();
  });
});

describe("FinanceReader demo (RF29, CA35)", () => {
  it.each([
    ["getSummary", ["2026-10"], "/api/demo/summary"],
    ["listCards", [], "/api/demo/cards"],
    ["listCategories", [], "/api/demo/categories"],
    ["listInvoices", ["2026-10"], "/api/demo/invoices"],
    ["listExpenses", [{ month: "2026-10" }], "/api/demo/entries/expenses"],
    ["listIncomes", [{ month: "2026-10" }], "/api/demo/entries/incomes"],
    ["getMonthlySeries", ["2026-10"], "/api/demo/dashboard/monthly-series"],
    ["getCategoryDistribution", ["2026-10"], "/api/demo/dashboard/category-distribution"],
    ["listInvoiceEntries", ["0192f1e2-0000-7000-8000-000000000001", "2026-10"], "/api/demo/cards/0192f1e2-0000-7000-8000-000000000001/invoices/2026-10/entries"],
  ] as const)("%s -> %s, SEM Authorization mesmo com cookie", async (method, args, path) => {
    reply(200, { items: [], totals: {} });
    await (createFinanceReader("demo")[method] as (...a: unknown[]) => Promise<unknown>)(...args);
    expect(sent().url.pathname).toBe(path);
    expect(sent().headers.get("authorization")).toBeNull();
  });

  it("funciona sem cookie", async () => {
    session.readSessionToken.mockResolvedValue(undefined);
    reply(200, { items: [] });
    await createFinanceReader("demo").listCards();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("o reader demo so le: nao expoe nenhuma funcao de escrita", () => {
    const names = Object.keys(createFinanceReader("demo"));
    expect(names.filter((n) => /create|pay|update|delete/i.test(n))).toEqual([]);
  });

  it("falha da demo (500) nao redireciona para o login", async () => {
    reply(500, { code: "INTERNAL_ERROR", message: "x" });
    await expect(createFinanceReader("demo").listCards()).rejects.toMatchObject({ status: 500 });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});
