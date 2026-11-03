import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardLoading } from "./dashboard-loading";

const FORBIDDEN = /(^|:)(col-span-|col-start-|row-start-|order-|grid-cols-(?!1$)|flex-row|flex-col-reverse|flex-row-reverse)/;
const skeletonOf = (label: string) => screen.getByText(label).closest('[aria-busy="true"]')!;
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("DashboardLoading (ADR 0012, RF05, CA04)", () => {
  it("anuncia o carregamento dos dois blocos e a evolucao mensal vem antes das despesas por categoria", () => {
    render(<DashboardLoading />);
    const monthly = skeletonOf("Carregando evolução mensal");
    const donut = skeletonOf("Carregando despesas por categoria");
    expect(monthly).toBeInTheDocument();
    expect(donut).toBeInTheDocument();
    expect(precedes(monthly, donut)).toBe(true);
    expect(precedes(skeletonOf("Carregando resumo do mês"), monthly)).toBe(true);
  });

  it("usa a mesma pilha da tela: sem col-span, grid de varias colunas ou flex-row ao redor dos skeletons (CA02)", () => {
    const { container } = render(<DashboardLoading />);
    for (const label of ["Carregando evolução mensal", "Carregando despesas por categoria"]) {
      for (let el: Element | null = skeletonOf(label).parentElement; el && el !== container; el = el.parentElement) {
        expect([...el.classList].filter((c) => FORBIDDEN.test(c)), `${label} -> ${el.className}`).toEqual([]);
      }
    }
  });

  it("os dois skeletons sao filhos de wrappers irmaos na mesma coluna, com o gap do dashboard", () => {
    render(<DashboardLoading />);
    const a = skeletonOf("Carregando evolução mensal").parentElement!;
    const b = skeletonOf("Carregando despesas por categoria").parentElement!;
    expect(a.parentElement).toBe(b.parentElement);
    expect(a.parentElement).toHaveClass("flex", "flex-col", "gap-4", "md:gap-6");
  });
});
