import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TotalsDto } from "@/lib/api/types";
import { MonthSummary, MonthSummarySkeleton } from "./month-summary";

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

const emptyTotals: TotalsDto = { income: "0.00", expenses: { total: "0.00", paid: "0.00", pending: "0.00" }, balance: { realized: "0.00", projected: "0.00" } };
const hasClass = (el: Element, name: string) => el.classList.contains(name);
const classTokens = (el: Element) => el.className.toString().split(/\s+/).filter(Boolean);

/**
 * Resumo sem card externo (spec CA15-CA18, CA20; ADR 0004 5.7; design 5). Um layout so em todos os breakpoints:
 * titulo visivel, 3 cards de vidro soltos num `dl`, aviso de mes vazio abaixo. jsdom nao aplica CSS: verificamos a MARCACAO
 * (o que e card, o que carrega fundo/borda/sombra, quem e filho de quem); os computados reais ficam no e2e.
 */
describe("MonthSummary sem card externo (RF12-RF15, CA15/CA16/CA18)", () => {
  const renderRegion = (t: TotalsDto = totals()) => {
    render(<MonthSummary month="2026-10" totals={t} headingId="h" />);
    return screen.getByRole("region", { name: "Resumo de outubro de 2026" });
  };

  it("o titulo e um heading de nivel 2 visivel em todos os breakpoints: sem sr-only (B5) e sem md:not-sr-only", () => {
    renderRegion();
    const h = screen.getByRole("heading", { level: 2, name: "Resumo de outubro de 2026" });
    expect(classTokens(h).some((c) => /(^|:)(sr-only|not-sr-only)$/.test(c)), `classes: ${h.className}`).toBe(false);
    expect(classTokens(h)).toContain("text-muted"); // texto simples --text-muted (design 5.3)
    expect(h).toBeVisible();
  });

  it("a regiao e nomeada pelo titulo (aria-labelledby aponta para o h2)", () => {
    const region = renderRegion();
    const h = screen.getByRole("heading", { level: 2 });
    expect(region.getAttribute("aria-labelledby")).toBe(h.id);
    expect(h.id).toBe("h");
  });

  it("a regiao (section) nao tem card, fundo, borda nem sombra em nenhum breakpoint (nao basta anular com md:*)", () => {
    const region = renderRegion();
    const bad = classTokens(region).filter((c) => /(^|:)(card|glass|glass-flat|glass-bar|bg-[\w-]+|border(-[\w-]+)?|shadow(-[\w-]+)?|rounded(-[\w-]+)?)$/.test(c));
    expect(bad, `classes de contêiner de card na regiao: ${region.className}`).toEqual([]);
    // nem um unico wrapper entre a regiao e o dl com aparencia de card
    const dl = region.querySelector("dl")!;
    for (let node: Element | null = dl.parentElement; node && node !== region.parentElement; node = node.parentElement) {
      expect(classTokens(node).some((c) => /(^|:)(card|glass|bg-surface|shadow-card)$/.test(c)), `ancestral ${node.tagName} com cara de card`).toBe(false);
    }
  });

  it("os tres grupos sao tres .card filhos DIRETOS de um unico dl (Receitas, Despesas, Saldo)", () => {
    const region = renderRegion();
    const dls = region.querySelectorAll("dl");
    expect(dls).toHaveLength(1);
    const cards = [...dls[0].children];
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.tagName).toBe("DIV");
      expect(hasClass(card, "card")).toBe(true);
    }
    expect(cards[0].textContent).toContain("Receitas");
    expect(cards[1].textContent).toContain("Despesas");
    expect(cards[2].textContent).toContain("Saldo realizado");
    // nenhum .card fora dos tres grupos (nada de card aninhado em card)
    expect(region.querySelectorAll(".card")).toHaveLength(3);
    for (const card of cards) expect(card.querySelector(".card")).toBeNull();
  });

  it("cada card nao anula o proprio fundo com utilitarios (sem md:bg-transparent / md:border-0 / md:shadow-none / md:card)", () => {
    const region = renderRegion();
    for (const card of region.querySelectorAll(".card")) {
      expect(classTokens(card).filter((c) => /^(sm|md|lg|xl):(card|bg-|border|shadow)/.test(c) || /(bg-transparent|border-0|shadow-none)$/.test(c)), card.className).toEqual([]);
    }
  });

  it("marcacao valida de dl: todo dt/dd tem como pai o dl ou um div filho direto do dl", () => {
    const region = renderRegion();
    const dl = region.querySelector("dl")!;
    const items = region.querySelectorAll("dt, dd");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const parent = item.parentElement!;
      const ok = parent === dl || (parent.tagName === "DIV" && parent.parentElement === dl);
      expect(ok, `<${item.tagName.toLowerCase()}> "${item.textContent?.slice(0, 20)}" aninhado em ${parent.tagName}`).toBe(true);
    }
  });

  it("nao ha <p> dentro dos grupos do dl (as dicas de formula ficam dentro do dd)", () => {
    const region = renderRegion();
    expect(region.querySelectorAll("dl p")).toHaveLength(0);
  });

  it("os seis valores continuam em pares dt/dd, na ordem Receitas, Despesas, Pago, Pendente, Saldo realizado, Saldo previsto", () => {
    const region = renderRegion();
    const dts = [...region.querySelectorAll("dt")].map((d) => d.textContent?.trim());
    expect(dts).toEqual(["Receitas", "Despesas", "Pago", "Pendente", "Saldo realizado", "Saldo previsto"]);
    expect(region.querySelectorAll("dd")).toHaveLength(6);
    // cada dt e seguido do seu dd (par), com o valor formatado
    const expected = ["R$ 5.000,00", "R$ 5.500,00", "R$ 3.000,00", "R$ 2.500,00", "R$ 2.000,00", "-R$ 500,00"];
    region.querySelectorAll("dt").forEach((dt, i) => {
      expect(dt.nextElementSibling?.tagName, dts[i]).toBe("DD");
      expect(nbsp(dt.nextElementSibling!.textContent)).toContain(expected[i]);
    });
  });

  it("ordem de leitura: titulo, Receitas, Despesas, Saldo, e o texto da regiao nao muda (PA9)", () => {
    const region = renderRegion();
    const text = nbsp(region.textContent);
    const order = ["Resumo de outubro de 2026", "Receitas", "Despesas", "Saldo realizado", "Saldo previsto"].map((t) => text.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("as dicas de formula e o title ficam no dd do saldo (dl valido), mantendo o texto", () => {
    const region = renderRegion();
    const realized = region.querySelector('[title="receitas − despesas pagas"]');
    const projected = region.querySelector('[title="receitas − todas as despesas"]');
    expect(realized?.tagName).toBe("DD");
    expect(projected?.tagName).toBe("DD");
    expect(realized!.textContent).toContain("receitas − despesas pagas");
    expect(projected!.textContent).toContain("receitas − todas as despesas");
  });

  it("o titulo vem antes do dl, e o dl e filho direto da regiao", () => {
    const region = renderRegion();
    const h = screen.getByRole("heading", { level: 2 });
    const dl = region.querySelector("dl")!;
    expect(dl.parentElement).toBe(region);
    expect(h.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("MonthSummary - aviso de mes vazio (RF14, CA17)", () => {
  it("fica DEPOIS do dl, dentro da regiao e fora de qualquer card (texto simples)", () => {
    render(<MonthSummary month="2026-11" totals={emptyTotals} headingId="h" />);
    const region = screen.getByRole("region", { name: "Resumo de novembro de 2026" });
    const notice = within(region).getByText("Sem lançamentos neste mês");
    expect(notice.closest(".card")).toBeNull();
    expect(notice.closest("dl")).toBeNull();
    const dl = region.querySelector("dl")!;
    expect(dl.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.parentElement).toBe(region);
    // os tres cards seguem presentes com R$ 0,00 e o saldo "Zerado"
    expect(region.querySelectorAll(".card")).toHaveLength(3);
    expect(nbsp(region.textContent).match(/R\$ 0,00/g)).toHaveLength(6);
    expect(within(region).getAllByText("Zerado")).toHaveLength(2);
  });

  it("com lancamentos o aviso nao aparece", () => {
    render(<MonthSummary month="2026-10" totals={totals()} headingId="h" />);
    expect(screen.queryByText("Sem lançamentos neste mês")).not.toBeInTheDocument();
  });

  it("basta um total diferente de zero para o aviso sumir", () => {
    render(<MonthSummary month="2026-10" totals={{ ...emptyTotals, expenses: { total: "0.01", paid: "0.00", pending: "0.01" } }} headingId="h" />);
    expect(screen.queryByText("Sem lançamentos neste mês")).not.toBeInTheDocument();
  });
});

describe("MonthSummarySkeleton (RF16, CA20)", () => {
  const renderBoth = () => {
    const sk = render(<MonthSummarySkeleton />);
    const real = render(<MonthSummary month="2026-10" totals={totals()} headingId="h" />);
    return { skeleton: sk.container, real: real.container };
  };

  it("aria-busy, texto para leitor de tela e nenhum card externo", () => {
    const { container } = render(<MonthSummarySkeleton />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(root.textContent).toContain("Carregando resumo do mês");
    expect(classTokens(root).filter((c) => /(^|:)(card|glass|bg-[\w-]+|border(-[\w-]+)?|shadow(-[\w-]+)?)$/.test(c))).toEqual([]);
  });

  it("reproduz o layout novo: 1 bloco de titulo + 3 cards soltos com 1, 3 e 2 linhas (rotulo + valor por linha)", () => {
    const { container } = render(<MonthSummarySkeleton />);
    const cards = container.querySelectorAll(".card");
    expect(cards).toHaveLength(3);
    // cada linha = 1 bloco de rotulo + 1 de valor
    expect([...cards].map((c) => c.querySelectorAll(".skeleton").length)).toEqual([2, 6, 4]);
    // titulo: um bloco skeleton fora dos cards, antes deles
    const outside = [...container.querySelectorAll(".skeleton")].filter((s) => !s.closest(".card"));
    expect(outside).toHaveLength(1);
    expect(outside[0].compareDocumentPosition(cards[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // nenhum card dentro de card
    for (const c of cards) expect(c.querySelector(".card")).toBeNull();
  });

  it("usa as MESMAS classes de grade e de card do componente real (constantes compartilhadas, sem salto de layout)", () => {
    const { skeleton, real } = renderBoth();
    const skGrid = skeleton.querySelector(".card")!.parentElement!;
    const realGrid = real.querySelector("dl")!;
    expect(skGrid.className).toBe(realGrid.className);
    const skCards = [...skeleton.querySelectorAll(".card")];
    const realCards = [...real.querySelectorAll(".card")];
    expect(skCards.map((c) => c.className)).toEqual(realCards.map((c) => c.className));
  });

  it("o skeleton e a regiao real empilham titulo e cards na mesma coluna (flex-col, mesmo espacamento)", () => {
    const { skeleton, real } = renderBoth();
    const realRoot = real.querySelector("section")!;
    const skRoot = skeleton.firstElementChild!;
    const layout = (el: Element) => classTokens(el).filter((c) => /^(flex|flex-col|grid|gap-[\d.]+)$/.test(c)).sort();
    expect(layout(realRoot)).toEqual(expect.arrayContaining(["flex", "flex-col"]));
    expect(layout(skRoot)).toEqual(layout(realRoot));
  });
});
