import { describe, expect, it } from "vitest";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { EntryDto } from "@/lib/api/types";
import { createdFeedback, matchesFilters } from "./feedback";

const NOW = new Date("2026-10-24T13:00:00.000Z");
const state = (raw: Record<string, string> = {}) => parseEntriesSearchParams({ month: "2026-10", ...raw }, NOW);
const NUBANK = { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank" };

const entry = (over: Partial<EntryDto> = {}): EntryDto => ({
  id: "e1",
  type: "EXPENSE",
  description: "Mercado",
  category: "Alimentação",
  date: "2026-10-10",
  amount: "250.00",
  paymentMethod: "PIX",
  card: null,
  invoice: null,
  referenceMonth: "2026-10",
  status: "PAID",
  paidAt: "2026-10-10T13:00:00.000Z",
  createdAt: "",
  updatedAt: "",
  ...over,
});
const cardEntry = (over: Partial<EntryDto> = {}) =>
  entry({ paymentMethod: "CARD", card: NUBANK, invoice: { closingDate: "2026-10-25", dueDate: "2026-11-05" }, referenceMonth: "2026-11", status: "PENDING", paidAt: null, ...over });

describe("createdFeedback - D25 / CA74: dados da RESPOSTA, nunca da data da compra", () => {
  it("cartao: usa referenceMonth, cartao e vencimento da resposta e leva ao mes de referencia", () => {
    const fb = createdFeedback(cardEntry(), state());
    expect(fb.message).toBe("Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026. Ela está em novembro de 2026.");
    // CA41: "Ver <mes>" abre Despesas em "Todos", para a despesa (inclusive PIX ja paga) aparecer
    expect(fb.action).toEqual({ label: "Ver novembro", href: "/entries?month=2026-11&d_status=ALL" });
  });

  it("cartao no mesmo mes selecionado e na aba Faturas: sem acao (o bloco e atualizado)", () => {
    const fb = createdFeedback(cardEntry(), state({ month: "2026-11", tab: "invoices" }));
    expect(fb.action).toBeUndefined();
    expect(fb.message).toBe("Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026.");
  });

  it("PIX pago / pendente e receita (com 'Todos' ativo; sob o padrao Pendente a paga ganha o aviso de CA40)", () => {
    expect(createdFeedback(entry(), state({ d_status: "ALL" })).message).toBe("Despesa criada como paga.");
    expect(createdFeedback(entry({ status: "PENDING" }), state()).message).toBe("Despesa criada como pendente.");
    expect(createdFeedback(entry({ type: "INCOME", status: "RECEIVED" }), state({ tab: "income" })).message).toBe("Receita criada.");
  });

  it("mesmo mes, aba de outro tipo: oferece 'Ver receitas' / 'Ver despesas'", () => {
    const income = createdFeedback(entry({ type: "INCOME", status: "RECEIVED" }), state());
    expect(income.action?.label).toBe("Ver receitas");
    expect(income.action?.href.startsWith("/entries?month=2026-10&")).toBe(true);
    expect(new URLSearchParams(income.action!.href.split("?")[1]).get("tab")).toBe("income");
    const expense = createdFeedback(entry(), state({ tab: "income" }));
    // a despesa criada ja paga so aparece em Despesas com "Todos"
    expect(expense.action).toEqual({ label: "Ver despesas", href: "/entries?month=2026-10&d_status=ALL" });
  });

  it("receita criada na aba Faturas leva a Receitas", () => {
    expect(createdFeedback(entry({ type: "INCOME", status: "RECEIVED" }), state({ tab: "invoices" })).action?.label).toBe("Ver receitas");
  });

  it("excluida pelos filtros: explica e oferece 'Limpar filtros' (-> Todos) sem mexer em mes e aba", () => {
    const fb = createdFeedback(entry(), state({ d_status: "PENDING", d_category: "Moradia" }));
    expect(fb.message).toBe("Despesa criada como paga. Ela não aparece nos filtros atuais.");
    expect(fb.action).toEqual({ label: "Limpar filtros", href: "/entries?month=2026-10&d_status=ALL" });
  });

  it("CA40: sob o padrao Pendente, despesa PIX PAGA criada no mes da tela nao aparece: aviso + 'Limpar filtros' que leva a Todos", () => {
    const fb = createdFeedback(entry(), state());
    expect(fb.message).toBe("Despesa criada como paga. Ela não aparece nos filtros atuais.");
    expect(fb.action?.label).toBe("Limpar filtros");
    const target = new URLSearchParams(fb.action!.href.split("?")[1]);
    expect(target.get("month")).toBe("2026-10");
    expect(target.get("d_status")).toBe("ALL");
    expect(target.has("tab")).toBe(false);
  });

  it("CA40: sob o padrao, despesa PIX PENDENTE criada aparece (sem aviso, sem acao)", () => {
    expect(createdFeedback(entry({ status: "PENDING", paidAt: null }), state()).action).toBeUndefined();
  });

  it("CA41: despesa PIX paga de outro mes, 'Ver outubro' abre Despesas em Todos naquele mes", () => {
    const fb = createdFeedback(entry({ referenceMonth: "2026-10" }), state({ month: "2026-11" }));
    expect(fb.action?.label).toBe("Ver outubro");
    const target = new URLSearchParams(fb.action!.href.split("?")[1]);
    expect(target.get("month")).toBe("2026-10");
    expect(target.get("d_status")).toBe("ALL");
    expect(target.has("d_category")).toBe(false);
    expect(target.has("d_card")).toBe(false);
  });

  it("'Ver <mes>' tambem limpa categoria e cartao ja aplicados, para a despesa aparecer", () => {
    const fb = createdFeedback(entry({ referenceMonth: "2026-10" }), state({ month: "2026-11", d_category: "Lazer", d_card: "pix", d_status: "PAID" }));
    const target = new URLSearchParams(fb.action!.href.split("?")[1]);
    expect(target.get("d_status")).toBe("ALL");
    expect(target.has("d_category")).toBe(false);
    expect(target.has("d_card")).toBe(false);
  });

  it("filtros de cartao: PIX x cartao especifico", () => {
    expect(createdFeedback(entry(), state({ d_card: NUBANK.id })).action?.label).toBe("Limpar filtros");
    expect(createdFeedback(cardEntry({ referenceMonth: "2026-10" }), state({ d_card: "pix" })).action?.label).toBe("Limpar filtros");
    expect(createdFeedback(entry(), state({ d_card: "pix", d_status: "ALL" })).action).toBeUndefined();
  });

  it("aparece nos filtros da aba Receitas (categoria sem diferenciar maiusculas)", () => {
    const inc = entry({ type: "INCOME", status: "RECEIVED", category: "Salário" });
    expect(createdFeedback(inc, state({ tab: "income", r_category: "salário" })).action).toBeUndefined();
    expect(createdFeedback(inc, state({ tab: "income", r_category: "Freela" })).action?.href).toBe("/entries?month=2026-10&tab=income");
  });
});

describe("matchesFilters - status padrao e aba Faturas (ADR 0007 7.6, CA40, CA57)", () => {
  it("Despesas: o padrao Pendente exclui a despesa paga; Todos inclui; Pago exclui a pendente", () => {
    expect(matchesFilters(entry(), state())).toBe(false);
    expect(matchesFilters(entry({ status: "PENDING", paidAt: null }), state())).toBe(true);
    expect(matchesFilters(entry(), state({ d_status: "ALL" }))).toBe(true);
    expect(matchesFilters(entry(), state({ d_status: "PAID" }))).toBe(true);
    expect(matchesFilters(entry({ status: "PENDING", paidAt: null }), state({ d_status: "PAID" }))).toBe(false);
  });

  it("Receitas: o status padrao nao se aplica (RF14)", () => {
    const income = entry({ type: "INCOME", status: "RECEIVED" });
    expect(matchesFilters(income, state({ tab: "income" }))).toBe(true);
  });

  it("Faturas: compra no cartao (sempre PENDENTE) aparece em Pendente e Todos, e some sob Pago", () => {
    const purchase = cardEntry({ referenceMonth: "2026-10" });
    expect(matchesFilters(purchase, state({ tab: "invoices" }))).toBe(true);
    expect(matchesFilters(purchase, state({ tab: "invoices", f_status: "ALL" }))).toBe(true);
    expect(matchesFilters(purchase, state({ tab: "invoices", f_status: "PAID" }))).toBe(false);
  });

  it("Faturas: o status de Despesas nao afeta (independentes, RF19)", () => {
    expect(matchesFilters(cardEntry({ referenceMonth: "2026-10" }), state({ tab: "invoices", d_status: "PAID" }))).toBe(true);
  });
});

describe("createdFeedback - aba Faturas (RF22, CA57, design 7)", () => {
  const nov = (raw: Record<string, string> = {}) => state({ month: "2026-11", tab: "invoices", ...raw });

  it("CA57: compra no cartao no mesmo mes com f_status=PAID: avisa que a fatura nao aparece e oferece 'Limpar filtros' (f_status=ALL)", () => {
    const fb = createdFeedback(cardEntry(), nov({ f_status: "PAID" }));
    expect(fb.message).toBe("Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026. Ela não aparece nos filtros atuais.");
    expect(fb.action?.label).toBe("Limpar filtros");
    const target = new URLSearchParams(fb.action!.href.split("?")[1]);
    expect(target.get("month")).toBe("2026-11");
    expect(target.get("tab")).toBe("invoices");
    expect(target.get("f_status")).toBe("ALL");
  });

  it("'Limpar filtros' de Faturas nao altera o status de Despesas (RF19)", () => {
    const fb = createdFeedback(cardEntry(), nov({ f_status: "PAID", d_status: "PAID" }));
    expect(new URLSearchParams(fb.action!.href.split("?")[1]).get("d_status")).toBe("PAID");
  });

  it("Pendente ou Todos: sem acao, o bloco aparece", () => {
    expect(createdFeedback(cardEntry(), nov()).action).toBeUndefined();
    expect(createdFeedback(cardEntry(), nov({ f_status: "ALL" })).action).toBeUndefined();
  });

  it("outro mes (qualquer filtro): 'Ver <mes>' abre Despesas em Todos", () => {
    const fb = createdFeedback(cardEntry({ referenceMonth: "2026-12" }), nov({ f_status: "PAID" }));
    expect(fb.action?.label).toBe("Ver dezembro");
    const target = new URLSearchParams(fb.action!.href.split("?")[1]);
    expect(target.get("month")).toBe("2026-12");
    expect(target.get("d_status")).toBe("ALL");
    expect(target.has("tab")).toBe(false);
  });

  it("PIX no mesmo mes, em Faturas: 'Ver despesas' abre Despesas em Todos", () => {
    const fb = createdFeedback(entry({ referenceMonth: "2026-11" }), nov());
    expect(fb.action?.label).toBe("Ver despesas");
    expect(new URLSearchParams(fb.action!.href.split("?")[1]).get("d_status")).toBe("ALL");
  });
});
