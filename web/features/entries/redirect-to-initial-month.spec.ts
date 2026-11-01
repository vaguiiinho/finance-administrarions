import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
}));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), ...nav }));

import { ApiError } from "@/lib/api/http";
import { DEMO_MODE, PROTECTED_MODE } from "@/lib/app-mode";
import { redirectToInitialMonth } from "./redirect-to-initial-month";

/**
 * ADR 0007 7.2: sem `month` na URL a pagina resolve o mes e chama `redirect()` (tipo replace), mantendo os demais parametros.
 * CONTRATO PROPOSTO PELO TESTER: redirectToInitialMonth(searchParams, mode, reader, now?) lanca o NEXT_REDIRECT ou nao faz nada.
 */
const NOW = new Date("2026-10-30T15:00:00.000Z"); // 12:00 em SP
const getInitialMonth = vi.fn();
const reader = { getInitialMonth: () => getInitialMonth() };
const run = (raw: Record<string, string | string[] | undefined>, mode = PROTECTED_MODE, now = NOW) => redirectToInitialMonth(raw, mode, reader, now);
const target = async (raw: Record<string, string | string[] | undefined>, mode = PROTECTED_MODE, now = NOW): Promise<string> => {
  await expect(run(raw, mode, now)).rejects.toThrow("NEXT_REDIRECT");
  return nav.redirect.mock.calls[0][0] as string;
};
const q = (href: string) => new URLSearchParams(href.split("?")[1]);

beforeEach(() => {
  getInitialMonth.mockReset();
  nav.redirect.mockClear();
});

describe("redirectToInitialMonth: `month` presente nao faz nada (RF06, RF08, CA26, CA27)", () => {
  it.each([["valido", "2026-10"], ["invalido", "abc"], ["fora de faixa", "2026-13"]])("month %s: sem leitura e sem redirect", async (_n, month) => {
    await run({ month });
    expect(getInitialMonth).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("outros parametros (tab, d_card) nao impedem o avanco (P05)", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-12", advance: "NEXT_PENDING" });
    const href = await target({ tab: "invoices", d_card: "pix" });
    expect(q(href).get("month")).toBe("2026-12");
  });
});

describe("redirectToInitialMonth: sucesso", () => {
  it("CA01: sem avanco redireciona para month=M, sem sinal de aviso", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-10", advance: "NONE" });
    const href = await target({});
    expect(href.startsWith("/entries?")).toBe(true);
    expect(q(href).get("month")).toBe("2026-10");
    expect(q(href).has("adv")).toBe(false);
  });

  it("CA06: com avanco acrescenta adv e adv_from", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-12", advance: "NEXT_PENDING" });
    const href = await target({});
    expect(q(href).get("month")).toBe("2026-12");
    expect(q(href).get("adv")).toBe("NEXT_PENDING");
    expect(q(href).get("adv_from")).toBe("2026-10");
  });

  it("CA02: NO_PENDING_AHEAD", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-11", advance: "NO_PENDING_AHEAD" });
    const href = await target({});
    expect(q(href).get("adv")).toBe("NO_PENDING_AHEAD");
  });

  it("fatura antiga pendente redireciona ao mês histórico sem aviso de avanço", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-11", month: "2026-10", advance: "NONE" });
    const href = await target({ tab: "invoices" });
    expect(q(href).get("month")).toBe("2026-10");
    expect(q(href).has("adv")).toBe(false);
    expect(q(href).get("tab")).toBe("invoices");
  });

  it("mantem os demais parametros (P05, RF03: /entries?tab=... sem month)", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-10", advance: "NONE" });
    const href = await target({ tab: "income", r_category: "Salário", f_status: "ALL" });
    expect(Object.fromEntries(q(href))).toMatchObject({ month: "2026-10", tab: "income", r_category: "Salário", f_status: "ALL" });
  });

  it("le a API uma unica vez", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-10", advance: "NONE" });
    await target({});
    expect(getInitialMonth).toHaveBeenCalledTimes(1);
  });

  it("demo: redireciona para /demo/entries com o mesmo formato (CA24)", async () => {
    getInitialMonth.mockResolvedValue({ currentMonth: "2026-10", month: "2026-10", advance: "NONE" });
    const href = await target({}, DEMO_MODE);
    expect(href.startsWith("/demo/entries?")).toBe(true);
    expect(q(href).get("month")).toBe("2026-10");
  });
});

describe("redirectToInitialMonth: falha da verificacao -> M do web, sem aviso (RNF02, CA22)", () => {
  it.each([
    ["500", new ApiError(500, "INTERNAL_ERROR", "x", null)],
    ["rede/timeout", new ApiError(0, "NETWORK_ERROR", "x", null)],
    ["erro generico", new Error("boom")],
  ])("%s: redireciona para month=<M em SP>, sem adv", async (_n, error) => {
    getInitialMonth.mockRejectedValue(error);
    const href = await target({ tab: "invoices" });
    expect(q(href).get("month")).toBe("2026-10");
    expect(q(href).has("adv")).toBe(false);
    expect(q(href).get("tab")).toBe("invoices");
  });

  it("o mes de fallback respeita America/Sao_Paulo (31/10 23:30 em SP ainda e outubro; 01/11 00:30 e novembro)", async () => {
    getInitialMonth.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    expect(q(await target({}, PROTECTED_MODE, new Date("2026-11-01T02:30:00.000Z"))).get("month")).toBe("2026-10");
    nav.redirect.mockClear();
    expect(q(await target({}, PROTECTED_MODE, new Date("2026-11-01T03:30:00.000Z"))).get("month")).toBe("2026-11");
  });

  it("redireciona tambem na falha (fixa o mes: a revalidacao pos-pagamento nao reaplica a regra, RF07)", async () => {
    getInitialMonth.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    await target({});
    expect(nav.redirect).toHaveBeenCalledTimes(1);
  });

  it("demo: falha resulta em M em /demo/entries, nunca em login", async () => {
    getInitialMonth.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    const href = await target({}, DEMO_MODE);
    expect(href.startsWith("/demo/entries?")).toBe(true);
    expect(href).not.toContain("login");
  });
});

describe("redirectToInitialMonth: sessao expirada continua indo ao login", () => {
  it("o redirect de 401/403 vindo do reader e repassado, nao trocado por month=M", async () => {
    getInitialMonth.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login?next=%2Fentries&reason=expired;307;" });
    });
    await expect(run({})).rejects.toMatchObject({ digest: expect.stringContaining("/login?next=") });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("idem quando a leitura devolve uma promessa rejeitada com o redirect", async () => {
    getInitialMonth.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/account/password?next=%2Fentries;307;" }));
    await expect(run({})).rejects.toMatchObject({ digest: expect.stringContaining("/account/password") });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});
