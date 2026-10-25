import { describe, expect, it } from "vitest";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { EntryDto } from "@/lib/api/types";
import { countLabel, createdFeedback, invoicePaidFeedback, paidFeedback } from "./feedback";

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
    expect(fb.action).toEqual({ label: "Ver novembro", href: "/entries?month=2026-11" });
  });

  it("cartao no mesmo mes selecionado e na aba Faturas: sem acao (o bloco e atualizado)", () => {
    const fb = createdFeedback(cardEntry(), state({ month: "2026-11", tab: "invoices" }));
    expect(fb.action).toBeUndefined();
    expect(fb.message).toBe("Lançamento criado na fatura de nov/26 do Nubank, vence 05/11/2026.");
  });

  it("PIX pago / pendente e receita", () => {
    expect(createdFeedback(entry(), state()).message).toBe("Despesa criada como paga.");
    expect(createdFeedback(entry({ status: "PENDING" }), state()).message).toBe("Despesa criada como pendente.");
    expect(createdFeedback(entry({ type: "INCOME", status: "RECEIVED" }), state({ tab: "income" })).message).toBe("Receita criada.");
  });

  it("mesmo mes, aba de outro tipo: oferece 'Ver receitas' / 'Ver despesas'", () => {
    const income = createdFeedback(entry({ type: "INCOME", status: "RECEIVED" }), state());
    expect(income.action).toEqual({ label: "Ver receitas", href: "/entries?month=2026-10&tab=income" });
    const expense = createdFeedback(entry(), state({ tab: "income" }));
    expect(expense.action).toEqual({ label: "Ver despesas", href: "/entries?month=2026-10" });
  });

  it("receita criada na aba Faturas leva a Receitas", () => {
    expect(createdFeedback(entry({ type: "INCOME", status: "RECEIVED" }), state({ tab: "invoices" })).action?.label).toBe("Ver receitas");
  });

  it("excluida pelos filtros: explica e oferece 'Limpar filtros' sem mexer em mes e aba", () => {
    const fb = createdFeedback(entry(), state({ d_status: "PENDING", d_category: "Moradia" }));
    expect(fb.message).toBe("Despesa criada como paga. Ela não aparece nos filtros atuais.");
    expect(fb.action).toEqual({ label: "Limpar filtros", href: "/entries?month=2026-10" });
  });

  it("filtros de cartao: PIX x cartao especifico", () => {
    expect(createdFeedback(entry(), state({ d_card: NUBANK.id })).action?.label).toBe("Limpar filtros");
    expect(createdFeedback(cardEntry({ referenceMonth: "2026-10" }), state({ d_card: "pix" })).action?.label).toBe("Limpar filtros");
    expect(createdFeedback(entry(), state({ d_card: "pix" })).action).toBeUndefined();
  });

  it("aparece nos filtros da aba Receitas (categoria sem diferenciar maiusculas)", () => {
    const inc = entry({ type: "INCOME", status: "RECEIVED", category: "Salário" });
    expect(createdFeedback(inc, state({ tab: "income", r_category: "salário" })).action).toBeUndefined();
    expect(createdFeedback(inc, state({ tab: "income", r_category: "Freela" })).action?.href).toBe("/entries?month=2026-10&tab=income");
  });
});

describe("invoicePaidFeedback - P21: valores da resposta de I3", () => {
  const invoice = { card: NUBANK, referenceMonth: "2026-11", totals: { total: "150.00", paid: "0.00", pending: "100.00" } };
  const money = (s: string) => s.replace(/ /g, " ");

  it("sucesso: cartao, mes abreviado, quantidade e valor", () => {
    expect(money(invoicePaidFeedback(invoice, { paidCount: 2, paidAmount: "100.00" }))).toBe("Fatura Nubank de nov/26 paga: 2 despesas, R$ 100,00.");
    expect(money(invoicePaidFeedback(invoice, { paidCount: 1, paidAmount: "100.00" }))).toContain("1 despesa,");
  });
  it("valor diferente do exibido explica a divergencia", () => {
    expect(money(invoicePaidFeedback(invoice, { paidCount: 3, paidAmount: "130.00" }))).toBe(
      "Fatura Nubank de nov/26 paga: 3 despesas, R$ 130,00. O valor difere do exibido porque a fatura mudou.",
    );
  });
  it("quantidade zero: nada alterado", () => {
    expect(invoicePaidFeedback(invoice, { paidCount: 0, paidAmount: "0.00" })).toBe("Nenhuma despesa pendente nesta fatura. Nada foi alterado.");
  });
});

describe("paidFeedback (3.10)", () => {
  it("lote, individual e ja pagas", () => {
    expect(paidFeedback({ paidCount: 3, alreadyPaidCount: 0 })).toBe("3 despesas marcadas como pagas.");
    expect(paidFeedback({ paidCount: 2, alreadyPaidCount: 1 })).toBe("2 despesas marcadas como pagas. 1 já estava paga.");
    expect(paidFeedback({ paidCount: 1, alreadyPaidCount: 0 }, "Aluguel")).toBe('"Aluguel" marcado como pago.');
    expect(paidFeedback({ paidCount: 1, alreadyPaidCount: 2 })).toBe("1 despesa marcada como paga. 2 já estavam pagas.");
  });
  it("countLabel pluraliza", () => {
    expect(countLabel(1, "despesa", "despesas")).toBe("1 despesa");
    expect(countLabel(0, "despesa", "despesas")).toBe("0 despesas");
  });
});
