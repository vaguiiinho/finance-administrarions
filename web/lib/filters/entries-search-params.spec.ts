import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATUS_FILTER,
  changeFilter,
  changeMonth,
  changePage,
  changeTab,
  clearExpenseFilters,
  clearInvoiceFilters,
  entriesHref,
  hasExpenseFilters,
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
    expect(s.invoices).toEqual({ status: "PENDING" });
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

  it("d_status aceita PENDING|PAID|ALL; ausente ou invalido vale o padrao PENDING (RF09, RF13, CA35)", () => {
    expect(parse({ d_status: "PAID" }).expenses.status).toBe("PAID");
    expect(parse({ d_status: "ALL" }).expenses.status).toBe("ALL");
    expect(parse({ d_status: "PENDING" }).expenses.status).toBe("PENDING");
    expect(parse({}).expenses.status).toBe("PENDING");
    expect(parse({ d_status: "RECEIVED" }).expenses.status).toBe("PENDING");
    expect(parse({ d_status: "pending" }).expenses.status).toBe("PENDING");
    expect(parse({ d_status: "all" }).expenses.status).toBe("PENDING");
    expect(parse({ d_status: "" }).expenses.status).toBe("PENDING");
  });

  it("DEFAULT_STATUS_FILTER e PENDING", () => {
    expect(DEFAULT_STATUS_FILTER).toBe("PENDING");
  });

  it("f_status (Faturas) tem as mesmas regras e e independente de d_status (RF13, RF19, CA48-CA50)", () => {
    expect(parse({ f_status: "PAID" }).invoices.status).toBe("PAID");
    expect(parse({ f_status: "ALL" }).invoices.status).toBe("ALL");
    expect(parse({}).invoices.status).toBe("PENDING");
    expect(parse({ f_status: "xyz" }).invoices.status).toBe("PENDING");
    expect(parse({ f_status: "pending" }).invoices.status).toBe("PENDING");
    const both = parse({ d_status: "ALL", f_status: "PAID" });
    expect(both.expenses.status).toBe("ALL");
    expect(both.invoices.status).toBe("PAID");
    expect(parse({ d_status: "PAID" }).invoices.status).toBe("PENDING");
    expect(parse({ f_status: "PAID" }).expenses.status).toBe("PENDING");
  });

  it("parametro repetido de status usa o primeiro valor", () => {
    expect(parse({ d_status: ["ALL", "PAID"] }).expenses.status).toBe("ALL");
    expect(parse({ f_status: ["PAID", "ALL"] }).invoices.status).toBe("PAID");
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

  it("sempre carrega o mes e usa os nomes do design (PENDING e omitido: forma canonica, ADR 7.1)", () => {
    const out = q(parse({ month: "2026-11", d_status: "PAID", d_category: "Moradia", d_card: UUID, r_category: "Salário" }));
    expect(out.get("month")).toBe("2026-11");
    expect(out.get("d_status")).toBe("PAID");
    expect(out.get("d_category")).toBe("Moradia");
    expect(out.get("d_card")).toBe(UUID);
    expect(out.get("r_category")).toBe("Salário");
  });

  it("omite o padrao PENDING e escreve PAID e ALL, para Despesas (d_status) e Faturas (f_status)", () => {
    expect(q(parse({ month: "2026-11" })).has("d_status")).toBe(false);
    expect(q(parse({ month: "2026-11" })).has("f_status")).toBe(false);
    expect(q(parse({ month: "2026-11", d_status: "PENDING", f_status: "PENDING" })).has("d_status")).toBe(false);
    expect(q(parse({ month: "2026-11", d_status: "PENDING", f_status: "PENDING" })).has("f_status")).toBe(false);
    expect(q(parse({ month: "2026-11", d_status: "ALL" })).get("d_status")).toBe("ALL");
    expect(q(parse({ month: "2026-11", d_status: "PAID" })).get("d_status")).toBe("PAID");
    expect(q(parse({ month: "2026-11", f_status: "ALL" })).get("f_status")).toBe("ALL");
    expect(q(parse({ month: "2026-11", f_status: "PAID" })).get("f_status")).toBe("PAID");
  });

  it("round trip preserva ALL e PAID nas duas abas", () => {
    for (const raw of [{ d_status: "ALL", f_status: "PAID" }, { d_status: "PAID", f_status: "ALL" }, { d_status: "ALL", f_status: "ALL" }]) {
      const s = parse({ month: "2026-11", ...raw });
      expect(parse(Object.fromEntries(q(s)))).toEqual(s);
    }
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
  const base = () => parse({ month: "2026-11", tab: "expenses", d_status: "PAID", d_category: "Moradia", r_category: "Salário", page: "4" });

  it("P34: trocar de aba mantem mes e filtros (de cada aba) e descarta a pagina", () => {
    const next = changeTab(base(), "income");
    expect(next.tab).toBe("income");
    expect(next.month).toBe("2026-11");
    expect(next.expenses).toEqual({ status: "PAID", category: "Moradia" });
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
    const next = changeFilter(base(), { d_status: "ALL" });
    expect(next.expenses.status).toBe("ALL");
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
    expect(next.expenses.status).toBe("PAID");
  });

  it("transicoes nao mutam o estado original", () => {
    const s = base();
    changeTab(s, "invoices");
    changeMonth(s, "2027-01");
    changeFilter(s, { d_status: "ALL" });
    expect(s.tab).toBe("expenses");
    expect(s.month).toBe("2026-11");
    expect(s.expenses.status).toBe("PAID");
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

  it("aba Despesas: o padrao PENDING vai a API como status=PENDING; ALL nunca vai (CA31, CA33, CA44)", () => {
    expect(toApiQuery(parse({ month: "2026-11" }))).toEqual({ month: "2026-11", status: "PENDING" });
    expect(toApiQuery(parse({ month: "2026-11", d_status: "PAID" }))).toEqual({ month: "2026-11", status: "PAID" });
    expect(toApiQuery(parse({ month: "2026-11", d_status: "ALL" }))).toEqual({ month: "2026-11" });
    expect(Object.keys(toApiQuery(parse({ month: "2026-11", d_status: "ALL", page: "2" })))).not.toContain("status");
  });

  it("aba Faturas: month + f_status (sem pagina nem filtros de Despesas); ALL nunca vai a API (CA45, CA47, CA50)", () => {
    expect(toApiQuery(parse({ month: "2026-11", tab: "invoices" }))).toEqual({ month: "2026-11", status: "PENDING" });
    expect(toApiQuery(parse({ month: "2026-11", tab: "invoices", f_status: "PAID", d_status: "ALL", d_category: "Moradia", page: "3" }))).toEqual({ month: "2026-11", status: "PAID" });
    expect(toApiQuery(parse({ month: "2026-11", tab: "invoices", f_status: "ALL", d_status: "PAID" }))).toEqual({ month: "2026-11" });
    expect(toApiQuery(parse({ month: "2026-11", tab: "invoices", f_status: "lixo" }))).toEqual({ month: "2026-11", status: "PENDING" });
  });

  it("aba Receitas nunca envia status, qualquer que seja d_status/f_status (CA44, RF14)", () => {
    for (const raw of [{}, { d_status: "ALL" }, { d_status: "PAID", f_status: "PAID" }]) {
      expect(toApiQuery(parse({ month: "2026-11", tab: "income", ...raw }))).toEqual({ month: "2026-11" });
    }
  });

  it("omite pagina 1 e filtros ausentes (alem do status padrao)", () => {
    expect(toApiQuery(parse({ month: "2026-11", tab: "income" }))).toEqual({ month: "2026-11" });
  });
});

describe("Limpar filtros: ponto unico (ADR 0007 7.1, RF11, R8)", () => {
  it("clearExpenseFilters leva a ALL e remove categoria e cartao, preservando mes, aba, Faturas e Receitas (CA36)", () => {
    const s = parse({ month: "2026-11", d_status: "PAID", d_category: "Moradia", d_card: "pix", f_status: "PAID", r_category: "Salário", page: "3" });
    const next = clearExpenseFilters(s);
    expect(next.expenses).toEqual({ status: "ALL" });
    expect(next.invoices.status).toBe("PAID");
    expect(next.incomes.category).toBe("Salário");
    expect(next.month).toBe("2026-11");
    expect(next.page).toBe(1);
  });

  it("depois de limpar, o estado serializa com d_status=ALL e nao some ao recarregar (R8: 'ausente' nao e mais Todos)", () => {
    const next = clearExpenseFilters(parse({ month: "2026-11" }));
    expect(q(next).get("d_status")).toBe("ALL");
    expect(parse(Object.fromEntries(q(next))).expenses.status).toBe("ALL");
  });

  it("clearInvoiceFilters leva a ALL so em Faturas, sem mexer em Despesas (RF19, CA51)", () => {
    const s = parse({ month: "2026-11", tab: "invoices", d_status: "PAID", d_category: "Moradia" });
    const next = clearInvoiceFilters(s);
    expect(next.invoices.status).toBe("ALL");
    expect(next.expenses).toEqual({ status: "PAID", category: "Moradia" });
    expect(next.tab).toBe("invoices");
    expect(next.month).toBe("2026-11");
    expect(q(next).get("f_status")).toBe("ALL");
  });

  it("nao mutam o estado original", () => {
    const s = parse({ month: "2026-11" });
    clearExpenseFilters(s);
    clearInvoiceFilters(s);
    expect(s.expenses.status).toBe("PENDING");
    expect(s.invoices.status).toBe("PENDING");
  });

  it("changeFilter troca f_status sem tocar em d_status e volta para a pagina 1 (RF19)", () => {
    const s = parse({ month: "2026-11", tab: "invoices", d_status: "PAID", page: "2" });
    const next = changeFilter(s, { f_status: "ALL" });
    expect(next.invoices.status).toBe("ALL");
    expect(next.expenses.status).toBe("PAID");
    expect(next.page).toBe(1);
    const back = changeFilter(next, { d_status: "ALL" });
    expect(back.invoices.status).toBe("ALL");
    expect(back.expenses.status).toBe("ALL");
  });

  it("changeFilter exige status explicito: d_status 'PENDING' volta ao padrao e some da URL", () => {
    const next = changeFilter(parse({ month: "2026-11", d_status: "ALL" }), { d_status: "PENDING" });
    expect(next.expenses.status).toBe("PENDING");
    expect(q(next).has("d_status")).toBe(false);
  });
});

describe("hasExpenseFilters: o padrao PENDING conta como filtro ativo (RF11, CA37)", () => {
  it("true com o padrao aplicado; false so com ALL e sem categoria/cartao", () => {
    expect(hasExpenseFilters(parse({ month: "2026-11" }))).toBe(true);
    expect(hasExpenseFilters(parse({ month: "2026-11", d_status: "PAID" }))).toBe(true);
    expect(hasExpenseFilters(parse({ month: "2026-11", d_status: "ALL" }))).toBe(false);
    expect(hasExpenseFilters(parse({ month: "2026-11", d_status: "ALL", d_category: "Moradia" }))).toBe(true);
    expect(hasExpenseFilters(parse({ month: "2026-11", d_status: "ALL", d_card: "pix" }))).toBe(true);
  });
});

describe("entriesHref: links internos sem status explicito recebem o padrao (P04, P06, CA43)", () => {
  it("um link sem status abre com Pendente (a URL nao carrega d_status)", () => {
    const href = entriesHref(parse({ month: "2026-11" }));
    expect(href).toBe("/entries?month=2026-11");
    expect(parse(Object.fromEntries(new URLSearchParams(href.split("?")[1]))).expenses.status).toBe("PENDING");
  });

  it("links antigos com d_status=PENDING continuam validos e so perdem o parametro na proxima navegacao", () => {
    const old = parse({ month: "2026-11", d_status: "PENDING" });
    expect(old.expenses.status).toBe("PENDING");
    expect(entriesHref(changePage(old, 2))).not.toContain("d_status");
  });

  it("basePath /demo e preservado", () => {
    expect(entriesHref(parse({ month: "2026-11", f_status: "ALL", tab: "invoices" }), "/demo")).toBe("/demo/entries?month=2026-11&tab=invoices&f_status=ALL");
  });
});

describe("mes inicial nao entra no estado (RF06, RF08, ADR 7.3)", () => {
  it("adv e adv_from nunca sao propagados por serializeEntriesState", () => {
    const out = q(parse({ month: "2026-12", adv: "NEXT_PENDING", adv_from: "2026-10" }));
    expect(out.has("adv")).toBe(false);
    expect(out.has("adv_from")).toBe(false);
  });
});
