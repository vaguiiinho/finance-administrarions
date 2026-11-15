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

import { getFinanceReader } from "./finance-reader";

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
    await getFinanceReader().getSummary("2026-10");
    expect(sent().url.pathname).toBe("/api/summary");
    expect(sent().url.searchParams.get("month")).toBe("2026-10");
    expect(sent().headers.get("authorization")).toBe("Bearer tok-abc");
  });

  it("401 -> redirect para o login com next = x-fa-url e reason=expired (PA1, CA06)", async () => {
    reply(401, { code: "UNAUTHENTICATED", message: "x" });
    await expect(getFinanceReader().getSummary("2026-10")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectedTo()).toBe("/login?next=%2Fdashboard%3Fmonth%3D2026-10&reason=expired");
  });

  it("sem cookie tambem vira redirect de login (nao chama a API)", async () => {
    session.readSessionToken.mockResolvedValue(undefined);
    await expect(getFinanceReader().listCards()).rejects.toThrow("NEXT_REDIRECT");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirectedTo()).toContain("/login");
  });

  it("403 PASSWORD_CHANGE_REQUIRED -> redirect para /account/password?next=<url atual> (CA08)", async () => {
    reply(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "x" });
    await expect(getFinanceReader().listCards()).rejects.toThrow("NEXT_REDIRECT");
    const u = new URL(redirectedTo() ?? "", "http://x");
    expect(u.pathname).toBe("/account/password");
    expect(u.searchParams.get("next")).toBe("/dashboard?month=2026-10");
  });

  it("403 FORBIDDEN -> notFound()", async () => {
    reply(403, { code: "FORBIDDEN", message: "x" });
    await expect(getFinanceReader().listCards()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(nav.notFound).toHaveBeenCalledTimes(1);
  });

  it("outros erros (500, 404 de id) continuam ApiError para o error.tsx/settle tratar", async () => {
    reply(500, { code: "INTERNAL_ERROR", message: "x" });
    await expect(getFinanceReader().listCards()).rejects.toMatchObject({ status: 500 });
    expect(nav.redirect).not.toHaveBeenCalled();
    expect(nav.notFound).not.toHaveBeenCalled();
  });
});

describe("FinanceReader: sem variante de demonstracao (ADR 0013 9.4, RF01, RF02)", () => {
  it("nenhuma leitura chama /api/demo/*: todas as rotas usam o prefixo protegido e o Bearer da sessao", async () => {
    reply(200, { items: [], totals: {} });
    const reader = getFinanceReader();
    await reader.getSummary("2026-10");
    await reader.listCards();
    await reader.listCategories();
    await reader.listInvoices({ month: "2026-10" });
    for (let i = 0; i < fetchMock.mock.calls.length; i++) {
      expect(sent(i).url.pathname).not.toMatch(/^\/api\/demo/);
      expect(sent(i).headers.get("authorization")).toBe("Bearer tok-abc");
    }
  });

  it("o reader nao aceita mais um 'tipo': getFinanceReader() nao recebe argumento", () => {
    expect(getFinanceReader.length).toBe(0);
  });

  it("sem cookie de sessao, a leitura redireciona para o login (nao ha mais leitura anonima)", async () => {
    session.readSessionToken.mockResolvedValue(undefined);
    reply(401, { code: "UNAUTHENTICATED", message: "x" });
    await expect(getFinanceReader().listCards()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectedTo()).toContain("/login");
  });
});

// ADR 0007 7.2 / 6.1 / 6.2: leitura do mes inicial e filtro de status de Faturas.
type ReaderWithInitialMonth = { getInitialMonth: () => Promise<{ currentMonth: string; month: string; advance: string }> };
const initialMonthOf = () => (getFinanceReader() as unknown as ReaderWithInitialMonth).getInitialMonth();

describe("FinanceReader.listInvoices com status (ADR 0007 T6, CA45, CA47)", () => {
  const list = (query: { month: string; status?: "PENDING" | "PAID" }) =>
    (getFinanceReader().listInvoices as unknown as (q: typeof query) => Promise<unknown>)(query);

  it("protegido: envia month e status=PENDING|PAID", async () => {
    reply(200, { month: "2026-10", items: [] });
    await list({ month: "2026-10", status: "PENDING" });
    expect(sent().url.pathname).toBe("/api/invoices");
    expect(sent().url.searchParams.get("month")).toBe("2026-10");
    expect(sent().url.searchParams.get("status")).toBe("PENDING");
    await list({ month: "2026-10", status: "PAID" });
    expect(sent(1).url.searchParams.get("status")).toBe("PAID");
  });

  it("sem status (Todos): a API NAO recebe o parametro; ALL nunca vai", async () => {
    reply(200, { month: "2026-10", items: [] });
    await list({ month: "2026-10" });
    expect(sent().url.searchParams.has("status")).toBe(false);
  });
});

describe("FinanceReader.getInitialMonth (ADR 0007 6.1, 7.2, RNF02)", () => {
  it("protegido: GET /api/entries/initial-month com o Bearer da sessao e sem query", async () => {
    reply(200, { currentMonth: "2026-10", month: "2026-12", advance: "NEXT_PENDING" });
    const result = await initialMonthOf();
    expect(result).toEqual({ currentMonth: "2026-10", month: "2026-12", advance: "NEXT_PENDING" });
    expect(sent().url.pathname).toBe("/api/entries/initial-month");
    expect(sent().url.search).toBe("");
    expect(sent().headers.get("authorization")).toBe("Bearer tok-abc");
  });

  it("401 repassa o redirect de login (sessao expirada continua levando ao login, RNF02)", async () => {
    reply(401, { code: "UNAUTHENTICATED", message: "x" });
    await expect(initialMonthOf()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectedTo()).toContain("reason=expired");
  });

  it("403 PASSWORD_CHANGE_REQUIRED repassa o redirect de troca de senha", async () => {
    reply(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "x" });
    await expect(initialMonthOf()).rejects.toThrow("NEXT_REDIRECT");
    expect(new URL(redirectedTo() ?? "", "http://x").pathname).toBe("/account/password");
  });

  it("500 vira ApiError (o redirecionador decide cair em M)", async () => {
    reply(500, { code: "INTERNAL_ERROR", message: "x" });
    await expect(initialMonthOf()).rejects.toMatchObject({ status: 500 });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("so essa leitura tem timeout (AbortSignal); as demais seguem sem sinal", async () => {
    reply(200, { currentMonth: "2026-10", month: "2026-10", advance: "NONE" });
    await initialMonthOf();
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    fetchMock.mockClear();
    reply(200, { items: [] });
    await getFinanceReader().listCards();
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal ?? null).toBeNull();
  });

  it("API travada: aborta em ~1,5 s e falha como ApiError (nao prende a tela no skeleton)", async () => {
    fetchMock.mockImplementation(
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("abortado")));
        }),
    );
    const started = Date.now();
    await expect(initialMonthOf()).rejects.toBeInstanceOf(Error);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(1400);
    expect(elapsed).toBeLessThan(2500);
  }, 6000);
});
