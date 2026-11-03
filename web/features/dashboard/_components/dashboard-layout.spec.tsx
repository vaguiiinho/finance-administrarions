import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardLayout } from "./dashboard-layout";

/** Classes que colocariam blocos lado a lado, reordenariam ou deslocariam a ordem visual (CA01, CA02; ADR 0012 9.1). */
const FORBIDDEN = /(^|:)(col-span-|col-start-|row-start-|order-|grid-cols-(?!1$)|flex-row|flex-col-reverse|flex-row-reverse)/;
const forbiddenTokens = (el: Element) => [...el.classList].filter((c) => FORBIDDEN.test(c));

function renderLayout(withNotice = true) {
  return render(
    <DashboardLayout
      notice={withNotice ? <p data-testid="notice">aviso</p> : undefined}
      header={<h1 data-testid="header">cabecalho</h1>}
      summary={<section data-testid="summary">resumo</section>}
      monthly={<figure data-testid="monthly">evolucao</figure>}
      categories={<figure data-testid="categories">categorias</figure>}
    />,
  );
}
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("DashboardLayout (ADR 0012 5.3, RF01-RF04)", () => {
  it("ordem no DOM: aviso, cabecalho, resumo, evolucao mensal, despesas por categoria (CA01)", () => {
    renderLayout();
    const ids = ["notice", "header", "summary", "monthly", "categories"].map((id) => screen.getByTestId(id));
    for (let i = 0; i < ids.length - 1; i++) expect(precedes(ids[i], ids[i + 1]), `${i}`).toBe(true);
  });

  it("sem aviso, nao renderiza wrapper vazio para ele", () => {
    const { container } = renderLayout(false);
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();
    const stack = container.firstElementChild!;
    for (const child of Array.from(stack.children)) expect(child.textContent, "wrapper vazio").not.toBe("");
  });

  it("os dois blocos de grafico ficam empilhados em largura total: nenhuma classe de coluna, ordem ou linha ate a raiz (CA02)", () => {
    const { container } = renderLayout();
    for (const id of ["monthly", "categories"]) {
      for (let el: Element | null = screen.getByTestId(id); el && el !== container; el = el.parentElement) {
        expect(forbiddenTokens(el), `${id} -> ${el.tagName} ${el.className}`).toEqual([]);
      }
    }
  });

  it("a pilha e uma coluna unica com o espaçamento atual (gap-4, md:gap-6) e blocos com min-w-0 (RF04)", () => {
    const { container } = renderLayout();
    const stack = container.firstElementChild!;
    expect(stack).toHaveClass("flex", "flex-col", "gap-4", "md:gap-6");
    for (const id of ["monthly", "categories"]) expect(screen.getByTestId(id).parentElement).toHaveClass("min-w-0");
  });

  it("monthly e categories sao irmaos diretos de wrappers na mesma coluna (nenhum grid/lg:grid-cols no pai)", () => {
    renderLayout();
    const a = screen.getByTestId("monthly").parentElement!;
    const b = screen.getByTestId("categories").parentElement!;
    expect(a.parentElement).toBe(b.parentElement);
    expect(a.parentElement!.className).not.toMatch(/grid-cols-(?!1\b)/);
  });
});
