import { describe, expect, it } from "vitest";
import { countLabel, invoicePaidFeedback, paidFeedback } from "./payment-feedback";

const NUBANK = { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank" };

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
