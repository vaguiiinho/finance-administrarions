import { describe, expect, it } from "vitest";
import { fallbackMonthHref, hasMonthParam, initialMonthHref, parseAdvanceSignal, stripAdvanceSignal } from "./initial-month";

/**
 * Modulo puro do mes inicial (ADR 0007 7.2/7.3). CONTRATO PROPOSTO PELO TESTER (o ADR fixa comportamento, nao nomes):
 *  hasMonthParam(raw) | initialMonthHref(raw, decision, basePath) | fallbackMonthHref(raw, now, basePath)
 *  parseAdvanceSignal(raw, month) -> { advance, from } | null | stripAdvanceSignal(href).
 */
const qs = (href: string) => new URLSearchParams(href.split("?")[1]);
const pathOf = (href: string) => href.split("?")[0];

describe("hasMonthParam: so `month` presente (valido ou nao) impede o avanco (RF06, RF08, P05)", () => {
  it("true com month valido e com month invalido", () => {
    expect(hasMonthParam({ month: "2026-10" })).toBe(true);
    expect(hasMonthParam({ month: "abc" })).toBe(true);
    expect(hasMonthParam({ month: "2026-13" })).toBe(true);
    expect(hasMonthParam({ month: ["2026-10", "2026-11"] })).toBe(true);
  });

  it("false sem month, mesmo com outros parametros (tab, d_card, f_status...)", () => {
    expect(hasMonthParam({})).toBe(false);
    expect(hasMonthParam({ tab: "invoices" })).toBe(false);
    expect(hasMonthParam({ d_card: "pix", d_status: "ALL", f_status: "PAID", page: "2" })).toBe(false);
    expect(hasMonthParam({ month: undefined })).toBe(false);
  });
});

describe("initialMonthHref: redirecionamento para o mes resolvido (T2, RF03, P05)", () => {
  const decision = (over: Partial<{ currentMonth: string; month: string; advance: "NONE" | "NEXT_PENDING" | "NO_PENDING_AHEAD" }> = {}) => ({
    currentMonth: "2026-10",
    month: "2026-10",
    advance: "NONE" as const,
    ...over,
  });

  it("CA01: sem avanco, so acrescenta month (sem sinal de aviso)", () => {
    const href = initialMonthHref({}, decision(), "");
    expect(pathOf(href)).toBe("/entries");
    expect(qs(href).get("month")).toBe("2026-10");
    expect(qs(href).has("adv")).toBe(false);
    expect(qs(href).has("adv_from")).toBe(false);
  });

  it("CA06: NEXT_PENDING acrescenta adv e adv_from (= M, o mes sem pendencia)", () => {
    const href = initialMonthHref({}, decision({ month: "2026-12", advance: "NEXT_PENDING" }), "");
    expect(qs(href).get("month")).toBe("2026-12");
    expect(qs(href).get("adv")).toBe("NEXT_PENDING");
    expect(qs(href).get("adv_from")).toBe("2026-10");
  });

  it("CA02: NO_PENDING_AHEAD acrescenta adv e adv_from = M", () => {
    const href = initialMonthHref({}, decision({ month: "2026-11", advance: "NO_PENDING_AHEAD" }), "");
    expect(qs(href).get("adv")).toBe("NO_PENDING_AHEAD");
    expect(qs(href).get("adv_from")).toBe("2026-10");
  });

  it("CA16: virada de ano com salto de varios meses", () => {
    const href = initialMonthHref({}, { currentMonth: "2026-11", month: "2027-02", advance: "NEXT_PENDING" }, "");
    expect(qs(href).get("month")).toBe("2027-02");
    expect(qs(href).get("adv_from")).toBe("2026-11");
  });

  it("P05: os demais parametros sao mantidos (aba, filtros, cartao, pagina)", () => {
    const href = initialMonthHref({ tab: "invoices", f_status: "ALL", d_status: "PAID", d_card: "pix", d_category: "Moradia", r_category: "Salário", page: "2" }, decision({ month: "2026-12", advance: "NEXT_PENDING" }), "");
    const q = qs(href);
    expect(Object.fromEntries(q)).toMatchObject({ tab: "invoices", f_status: "ALL", d_status: "PAID", d_card: "pix", d_category: "Moradia", r_category: "Salário", page: "2", month: "2026-12" });
  });

  it("basePath /demo gera /demo/entries (mesma funcao na demo)", () => {
    expect(pathOf(initialMonthHref({}, decision(), "/demo"))).toBe("/demo/entries");
  });

  it("valores de parametro sao codificados (sem injecao de query)", () => {
    const href = initialMonthHref({ d_category: "A&month=2000-01" }, decision(), "");
    expect(qs(href).get("month")).toBe("2026-10");
    expect(qs(href).get("d_category")).toBe("A&month=2000-01");
  });
});

describe("fallbackMonthHref: falha na verificacao -> M do web, sem aviso (RNF02, RNF03, CA22)", () => {
  it("usa o mes corrente em America/Sao_Paulo, nunca UTC", () => {
    expect(qs(fallbackMonthHref({}, new Date("2026-11-01T02:30:00.000Z"), "")).get("month")).toBe("2026-10"); // 31/10 23:30 em SP
    expect(qs(fallbackMonthHref({}, new Date("2026-11-01T03:30:00.000Z"), "")).get("month")).toBe("2026-11");
    expect(qs(fallbackMonthHref({}, new Date("2027-01-01T02:30:00.000Z"), "")).get("month")).toBe("2026-12");
  });

  it("nao carrega sinal de aviso, mantem os demais parametros e respeita /demo", () => {
    const href = fallbackMonthHref({ tab: "invoices", f_status: "PAID" }, new Date("2026-10-30T15:00:00.000Z"), "/demo");
    expect(pathOf(href)).toBe("/demo/entries");
    expect(qs(href).has("adv")).toBe(false);
    expect(qs(href).get("tab")).toBe("invoices");
    expect(qs(href).get("f_status")).toBe("PAID");
  });
});

describe("parseAdvanceSignal: validacao do sinal de aviso (ADR 7.3, RNF05)", () => {
  it("sinal valido: adv na lista fechada, adv_from no formato e anterior ao mes da tela", () => {
    expect(parseAdvanceSignal({ adv: "NEXT_PENDING", adv_from: "2026-10" }, "2026-12")).toEqual({ advance: "NEXT_PENDING", from: "2026-10" });
    expect(parseAdvanceSignal({ adv: "NO_PENDING_AHEAD", adv_from: "2026-12" }, "2027-01")).toEqual({ advance: "NO_PENDING_AHEAD", from: "2026-12" });
  });

  it("ausente -> null", () => {
    expect(parseAdvanceSignal({}, "2026-12")).toBeNull();
    expect(parseAdvanceSignal({ adv: "NEXT_PENDING" }, "2026-12")).toBeNull();
    expect(parseAdvanceSignal({ adv_from: "2026-10" }, "2026-12")).toBeNull();
  });

  it.each([
    ["adv desconhecido", { adv: "NONE", adv_from: "2026-10" }],
    ["adv em minusculas", { adv: "next_pending", adv_from: "2026-10" }],
    ["adv com HTML", { adv: "<script>", adv_from: "2026-10" }],
    ["adv_from malformado", { adv: "NEXT_PENDING", adv_from: "2026-1" }],
    ["adv_from invalido", { adv: "NEXT_PENDING", adv_from: "2026-13" }],
    ["adv_from texto livre", { adv: "NEXT_PENDING", adv_from: "outubro" }],
  ])("%s -> ignorado sem erro", (_name, raw) => {
    expect(parseAdvanceSignal(raw, "2026-12")).toBeNull();
  });

  it("adv_from igual ou posterior ao mes da tela -> ignorado", () => {
    expect(parseAdvanceSignal({ adv: "NEXT_PENDING", adv_from: "2026-12" }, "2026-12")).toBeNull();
    expect(parseAdvanceSignal({ adv: "NEXT_PENDING", adv_from: "2027-01" }, "2026-12")).toBeNull();
  });

  it("comparacao entre anos e correta (2026-12 < 2027-01)", () => {
    expect(parseAdvanceSignal({ adv: "NEXT_PENDING", adv_from: "2026-12" }, "2027-01")).not.toBeNull();
    expect(parseAdvanceSignal({ adv: "NEXT_PENDING", adv_from: "2027-01" }, "2026-12")).toBeNull();
  });

  it("parametro repetido usa o primeiro valor", () => {
    expect(parseAdvanceSignal({ adv: ["NEXT_PENDING", "NO_PENDING_AHEAD"], adv_from: ["2026-10", "2020-01"] }, "2026-12")).toEqual({ advance: "NEXT_PENDING", from: "2026-10" });
  });
});

describe("stripAdvanceSignal: o cliente remove o sinal da URL na montagem (ADR 7.3)", () => {
  it("remove adv e adv_from e preserva o restante, na mesma ordem", () => {
    expect(stripAdvanceSignal("/entries?month=2026-12&adv=NEXT_PENDING&adv_from=2026-10&tab=invoices")).toBe("/entries?month=2026-12&tab=invoices");
  });

  it("sem outros parametros nao deixa '?' pendente", () => {
    expect(stripAdvanceSignal("/entries?adv=NEXT_PENDING&adv_from=2026-10")).toBe("/entries");
  });

  it("sem sinal, devolve igual; mantem /demo", () => {
    expect(stripAdvanceSignal("/demo/entries?month=2026-12")).toBe("/demo/entries?month=2026-12");
    expect(stripAdvanceSignal("/demo/entries?month=2026-12&adv=NO_PENDING_AHEAD&adv_from=2026-11")).toBe("/demo/entries?month=2026-12");
  });
});
