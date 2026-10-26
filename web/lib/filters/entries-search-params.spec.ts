import { describe, expect, it } from "vitest";
import {
  changeFilter,
  changeMonth,
  changePage,
  changeTab,
  parseEntriesSearchParams,
  serializeEntriesState,
  toApiQuery,
} from "./entries-search-params";

/**
 * CONTRATO PROPOSTO PELO TESTER (ADR 9.3 so fixa os nomes da URL):
 *  parseEntriesSearchParams(raw, now?) -> { month, monthWasInvalid, tab, page, expenses:{status?,category?,card?}, incomes:{category?} }
 *  serializeEntriesState(state) -> query string; changeTab/changeMonth/changeFilter/changePage -> novo estado; toApiQuery(state).
 */
const NOW = new Date("2026-11-01T02:30:00.000Z"); // outubro em Sao Paulo (CA61)
const UUID = "0192f1e2-0000-7000-8000-000000000001";
const parse = (raw: Record<string, string | string[] | undefined>) => parseEntriesSearchParams(raw, NOW);
const q = (state: Parameters<typeof serializeEntriesState>[0]) => new URLSearchParams(serializeEntriesState(state));

describe("parseEntriesSearchParams", () => {
  it("CA61: sem month usa o mes corrente em America/Sao_Paulo; aba padrao Despesas; pagina 1", () => {
    const s = parse({});
    expect(s.month).toBe("2026-10");
    expect(s.monthWasInvalid).toBe(false);
    expect(s.tab).toBe("expenses");
    expect(s.page).toBe(1);
  });

  it("le month, tab e filtros prefixados por aba", () => {
    const s = parse({ month: "2026-11", tab: "income", r_category: "Salário", d_status: "PENDING", d_category: "Moradia", d_card: UUID, page: "3" });
    expect(s.month).toBe("2026-11");
    expect(s.tab).toBe("income");
    expect(s.incomes.category).toBe("Salário");
    expect(s.expenses).toEqual({ status: "PENDING", category: "Moradia", card: UUID });
    expect(s.page).toBe(3);
  });

  it.each(["expenses", "invoices", "income"])("aceita tab=%s", (tab) => {
    expect(parse({ tab }).tab).toBe(tab);
  });

  it("tab invalida volta para Despesas", () => {
    expect(parse({ tab: "receitas" }).tab).toBe("expenses");
  });

  it("month invalido -> mes corrente com aviso", () => {
    const s = parse({ month: "2026-13" });
    expect(s.month).toBe("2026-10");
    expect(s.monthWasInvalid).toBe(true);
  });

  it("d_card aceita UUID ou 'pix'; outro valor e descartado", () => {
    expect(parse({ d_card: "pix" }).expenses.card).toBe("pix");
    expect(parse({ d_card: UUID }).expenses.card).toBe(UUID);
    expect(parse({ d_card: "none" }).expenses.card).toBeUndefined();
    expect(parse({ d_card: "abc" }).expenses.card).toBeUndefined();
  });

  it("d_status so PENDING|PAID", () => {
    expect(parse({ d_status: "PAID" }).expenses.status).toBe("PAID");
    expect(parse({ d_status: "RECEIVED" }).expenses.status).toBeUndefined();
    expect(parse({ d_status: "pending" }).expenses.status).toBeUndefined();
  });

  it("page invalida (0, negativa, nao numerica) vira 1", () => {
    for (const page of ["0", "-2", "abc", "1.5"]) expect(parse({ page }).page).toBe(1);
  });

  it("parametros legados (type, fromMonth, toMonth, period, cardId=none) sao descartados", () => {
    const s = parse({ type: "INCOME", fromMonth: "2026-01", toMonth: "2026-12", period: "all", cardId: "none" });
    const out = q(s);
    for (const legacy of ["type", "fromMonth", "toMonth", "period", "cardId"]) expect(out.has(legacy)).toBe(false);
    expect(Object.keys(toApiQuery(s))).not.toEqual(expect.arrayContaining(["type"]));
  });

  it("parametro repetido usa o primeiro valor valido sem quebrar", () => {
    expect(parse({ month: ["2026-11", "2026-12"] }).month).toBe("2026-11");
  });
});

describe("serializeEntriesState", () => {
  it("round trip: parse(serialize(x)) == x", () => {
    const s = parse({ month: "2026-11", tab: "expenses", d_status: "PAID", d_category: "Moradia", d_card: "pix", r_category: "Salário", page: "2" });
    const again = parse(Object.fromEntries(q(s)));
    expect(again).toEqual(s);
  });

  it("sempre carrega o mes e usa os nomes do design", () => {
    const out = q(parse({ month: "2026-11", d_status: "PENDING", d_category: "Moradia", d_card: UUID, r_category: "Salário" }));
    expect(out.get("month")).toBe("2026-11");
    expect(out.get("d_status")).toBe("PENDING");
    expect(out.get("d_category")).toBe("Moradia");
    expect(out.get("d_card")).toBe(UUID);
    expect(out.get("r_category")).toBe("Salário");
  });

  it("nao serializa filtros vazios nem pagina 1", () => {
    const out = q(parse({ month: "2026-11" }));
    expect([...out.keys()].filter((k) => k !== "month" && k !== "tab")).toEqual([]);
  });

  it("blocos expandidos nunca vao para a URL", () => {
    expect([...q(parse({ tab: "invoices", expanded: "x" })).keys()]).not.toContain("expanded");
  });
});

describe("transicoes de estado", () => {
  const base = () => parse({ month: "2026-11", tab: "expenses", d_status: "PENDING", d_category: "Moradia", r_category: "Salário", page: "4" });

  it("P34: trocar de aba mantem mes e filtros (de cada aba) e descarta a pagina", () => {
    const next = changeTab(base(), "income");
    expect(next.tab).toBe("income");
    expect(next.month).toBe("2026-11");
    expect(next.expenses).toEqual({ status: "PENDING", category: "Moradia" });
    expect(next.incomes.category).toBe("Salário");
    expect(next.page).toBe(1);
  });

  it("CA68: trocar de mes mantem a aba e descarta a pagina", () => {
    const s = parse({ month: "2026-10", tab: "invoices", page: "3" });
    const next = changeMonth(s, "2026-11");
    expect(next.month).toBe("2026-11");
    expect(next.tab).toBe("invoices");
    expect(next.page).toBe(1);
  });

  it("trocar de filtro descarta a pagina e preserva os demais", () => {
    const next = changeFilter(base(), { d_status: "PAID" });
    expect(next.expenses.status).toBe("PAID");
    expect(next.expenses.category).toBe("Moradia");
    expect(next.page).toBe(1);
  });

  it("limpar filtro (undefined) remove o parametro", () => {
    const next = changeFilter(base(), { d_category: undefined });
    expect(next.expenses.category).toBeUndefined();
    expect(q(next).has("d_category")).toBe(false);
  });

  it("changePage so altera a pagina", () => {
    const next = changePage(base(), 2);
    expect(next.page).toBe(2);
    expect(next.expenses.status).toBe("PENDING");
  });

  it("transicoes nao mutam o estado original", () => {
    const s = base();
    changeTab(s, "invoices");
    changeMonth(s, "2027-01");
    changeFilter(s, { d_status: "PAID" });
    expect(s.tab).toBe("expenses");
    expect(s.month).toBe("2026-11");
    expect(s.expenses.status).toBe("PENDING");
  });
});

describe("toApiQuery: mapeamento para E2/E3", () => {
  it("aba Despesas: d_status->status, d_category->category, d_card->cardId, page", () => {
    const s = parse({ month: "2026-11", tab: "expenses", d_status: "PENDING", d_category: "Moradia", d_card: "pix", r_category: "Salário", page: "2" });
    expect(toApiQuery(s)).toEqual({ month: "2026-11", status: "PENDING", category: "Moradia", cardId: "pix", page: "2" });
  });

  it("aba Receitas: r_category->category e nunca status/cardId", () => {
    const s = parse({ month: "2026-11", tab: "income", d_status: "PENDING", d_card: "pix", r_category: "Salário" });
    expect(toApiQuery(s)).toEqual({ month: "2026-11", category: "Salário" });
  });

  it("aba Faturas: so month (sem filtros nem pagina)", () => {
    const s = parse({ month: "2026-11", tab: "invoices", d_status: "PENDING", page: "3" });
    expect(toApiQuery(s)).toEqual({ month: "2026-11" });
  });

  it("omite pagina 1 e filtros ausentes", () => {
    expect(toApiQuery(parse({ month: "2026-11" }))).toEqual({ month: "2026-11" });
  });
});
