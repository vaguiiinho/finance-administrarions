import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TotalsDto } from "@/lib/api/types";
import { MonthSummary } from "./month-summary";

const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");
const totals = (over: Partial<TotalsDto> = {}): TotalsDto => ({
  income: "5000.00",
  expenses: { total: "5500.00", paid: "3000.00", pending: "2500.00" },
  balance: { realized: "2000.00", projected: "-500.00" },
  ...over,
});

describe("MonthSummary (RF10, CA59/CA60/CA65/CA67)", () => {
  it("regiao 'Resumo de <mes por extenso>' com os seis valores formatados pt-BR", () => {
    render(<MonthSummary month="2026-10" totals={totals()} headingId="h" />);
    const region = screen.getByRole("region", { name: "Resumo de outubro de 2026" });
    const text = nbsp(region.textContent);
    for (const value of ["R$ 5.000,00", "R$ 5.500,00", "R$ 3.000,00", "R$ 2.500,00", "R$ 2.000,00", "-R$ 500,00"]) expect(text).toContain(value);
    for (const label of ["Receitas", "Despesas", "Pago", "Pendente", "Saldo realizado", "Saldo previsto"]) expect(within(region).getAllByText(label).length).toBeGreaterThan(0);
  });

  it("saldo com sinal textual alem da cor: Positivo / Negativo / Zerado", () => {
    render(<MonthSummary month="2026-10" totals={totals({ balance: { realized: "2000.00", projected: "-500.00" } })} headingId="h" />);
    expect(screen.getByText("Positivo")).toBeInTheDocument();
    expect(screen.getByText("Negativo")).toBeInTheDocument();
  });

  it("mes sem lancamentos: tudo R$ 0,00, 'Zerado' e 'Sem lançamentos neste mês'", () => {
    render(
      <MonthSummary
        month="2026-11"
        totals={{ income: "0.00", expenses: { total: "0.00", paid: "0.00", pending: "0.00" }, balance: { realized: "0.00", projected: "0.00" } }}
        headingId="h"
      />,
    );
    expect(screen.getAllByText("Zerado")).toHaveLength(2);
    expect(screen.getByText("Sem lançamentos neste mês")).toBeInTheDocument();
    expect(nbsp(screen.getByRole("region").textContent)).not.toContain("-R$");
  });
});
