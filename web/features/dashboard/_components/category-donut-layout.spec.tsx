import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockedRecharts } from "@/test/helpers/recharts-mock";
import { formatBRL } from "@/lib/money/decimal";
import { formatPercent } from "@/lib/dashboard/chart-data";
import type { CategoryDistribution } from "@/lib/api/types";
import { CategoryDonut, DonutTooltip } from "./category-donut";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHART_HEADER_SKELETON, DONUT_CONTAINER, MONTHLY_CHART_HEIGHT } from "./chart-layout";
import { ChartSkeleton, DonutSkeleton } from "./dashboard-skeletons";

vi.mock("recharts", async (importOriginal) => mockedRecharts(await importOriginal<typeof import("recharts")>()));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

// ADR 0012 5.2/5.4 e design (decisoes do usuario: ponto de troca @3xl, escala do total, break-words no tooltip).
const LONG = "A".repeat(60);
const distribution = (): CategoryDistribution => ({
  month: "2026-11",
  total: "9999999999.99",
  items: [
    { category: LONG, total: "5000000000.00", percentage: "50.00" },
    { category: "Moradia", total: "2000000000.00", percentage: "20.00" },
    { category: "Transporte", total: "1000000000.00", percentage: "10.00" },
    { category: "Lazer", total: "800000000.00", percentage: "8.00" },
    { category: "Saude", total: "600000000.00", percentage: "6.00" },
    { category: "Educacao", total: "400000000.00", percentage: "4.00" },
    { category: "Viagem", total: "199999999.99", percentage: "2.00" },
  ],
});
const nbsp = (s: string) => s.replace(/\u00a0/g, " ");
const classes = (el: Element) => [...el.classList];
/** Primeiro ancestral (a partir do pai) que tenha a classe `@container`. */
const containerOf = (el: Element) => {
  for (let a = el.parentElement; a; a = a.parentElement) if (a.classList.contains("@container")) return a;
  return null;
};
const legend = (container: HTMLElement) => container.querySelector("ul")!;

describe("CategoryDonut: arranjo por container query (TQ2, B1)", () => {
  it("rosca e legenda ficam dentro de um contêiner @container, que nao e o proprio elemento do arranjo", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const ul = legend(container);
    const arrangement = ul.parentElement!;
    const cq = containerOf(arrangement);
    expect(cq, "ancestral @container").not.toBeNull();
    expect(cq).not.toBe(arrangement);
    expect(cq!.contains(container.querySelector(".recharts-wrapper"))).toBe(true);
  });

  it("empilhado por padrao e lado a lado a partir de @3xl (48rem), nunca por variante de viewport", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const arrangement = legend(container).parentElement!;
    const cls = classes(arrangement);
    expect(cls).toContain("flex");
    expect(cls).toContain("flex-col");
    expect(cls).toContain("items-center");
    expect(cls).toContain("@3xl:flex-row");
    expect(cls).toContain("@3xl:justify-center");
    expect(cls).toContain("@3xl:gap-8");
    expect(cls.filter((c) => /^(sm|md|lg|xl|2xl):/.test(c)), "variantes de viewport no arranjo").toEqual([]);
    expect(cls.filter((c) => /^@(2xl|xl|lg|md|sm):/.test(c)), "ponto de troca diferente de @3xl").toEqual([]);
  });

  it("legenda: largura total ate max-w-md (28rem), min-w-0, e cresce so a partir de @3xl", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const cls = classes(legend(container));
    for (const c of ["w-full", "min-w-0", "max-w-md", "flex", "flex-col", "gap-2", "@3xl:flex-1"]) expect(cls).toContain(c);
    expect(cls.filter((c) => /^(sm|md|lg|xl|2xl):/.test(c))).toEqual([]);
  });

  it("rosca mantem 220 x 220 px sem encolher (RF12, B2)", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const ring = container.querySelector(".recharts-wrapper")!.closest('[class*="h-[220px]"]')!;
    expect(ring).not.toBeNull();
    expect(classes(ring)).toEqual(expect.arrayContaining(["h-[220px]", "w-[220px]", "shrink-0"]));
  });

  it("estado vazio e visao Tabela nao usam o contêiner de arranjo (RF14, RF15)", async () => {
    const { container, unmount } = render(<CategoryDonut distribution={{ month: "2026-11", total: "0.00", items: [] }} />);
    expect(container.querySelector(".\\@container")).toBeNull();
    unmount();
    const r = render(<CategoryDonut distribution={distribution()} />);
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(r.container.querySelector("ul")).toBeNull();
    expect(screen.getByRole("group", { name: "Tabela de despesas por categoria" })).toHaveClass("overflow-x-auto");
  });
});

describe("CategoryDonut: item da legenda encolhe so o nome (RF10, TQ4, CA09)", () => {
  it("seis itens: 5 categorias + Outras", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    expect(legend(container).querySelectorAll("li")).toHaveLength(6);
  });

  it("li permite quebra de seguranca dentro do item e mantem alinhamento", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    for (const li of Array.from(legend(container).querySelectorAll("li"))) {
      expect(li).toHaveClass("flex", "flex-wrap", "items-center");
    }
  });

  it("nome: min-w-0 flex-1 basis-0 truncate; marcador shrink-0", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const li = legend(container).querySelector("li")!;
    const name = within(li).getByText(LONG);
    expect(classes(name)).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "basis-0", "truncate"]));
    const marker = li.querySelector('span[aria-hidden="true"]')!;
    expect(marker).toHaveClass("shrink-0");
  });

  it("valor: shrink-0 e whitespace-nowrap; percentual: shrink-0, whitespace-nowrap, min-w-14 e alinhado a direita", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    for (const li of Array.from(legend(container).querySelectorAll("li"))) {
      const money = li.querySelector(".money")!;
      expect(classes(money)).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap"]));
      const pct = li.lastElementChild!;
      expect(pct.textContent).toMatch(/%$/);
      expect(classes(pct)).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap", "min-w-14", "text-right"]));
      expect(pct).not.toHaveClass("w-14");
    }
  });

  it("aria-label do item mantem nome completo, valor e percentual mesmo com o nome truncado", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const li = legend(container).querySelector("li")!;
    expect(nbsp(li.getAttribute("aria-label")!)).toBe(nbsp(`${LONG}, ${formatBRL("5000000000.00")}, ${formatPercent("50.00")}`));
    expect(li).toHaveAttribute("tabindex", "0");
  });

  it("'Outras' continua com title listando as categorias agrupadas (RF13)", () => {
    const { container } = render(<CategoryDonut distribution={distribution()} />);
    const outras = within(legend(container)).getByText("Outras");
    expect(outras.getAttribute("title")).toContain("Viagem");
  });
});

describe("CategoryDonut: escala de fonte do total no centro (design 'Total no centro da rosca')", () => {
  const PX: Record<string, number> = { "text-lg": 18, "text-base": 16, "text-sm": 14, "text-xs": 12 };
  const HOLE = 149; // furo da rosca (px); JetBrains Mono avanca 0,6em por caractere
  const totalWithDigits = (n: number) => `${"9".repeat(n)}.99`;
  const SIZES = /^text-(xs|sm|base|lg|xl)$/;
  const totalElement = (container: HTMLElement) => {
    const money = container.querySelector(".recharts-wrapper")!.parentElement!.parentElement!.querySelector(".money")!;
    return money;
  };
  /** Classe de tamanho efetiva: a do proprio valor ou a do wrapper mais proximo, sem subir ate o rotulo "Total de despesas". */
  const effectiveSize = (money: Element) => {
    for (let el: Element | null = money; el && !el.classList.contains("absolute"); el = el.parentElement) {
      const found = classes(el).find((c) => SIZES.test(c));
      if (found) return found;
    }
    return undefined;
  };

  it.each([
    [6, 13, "text-lg"],
    [7, 15, "text-base"],
    [8, 16, "text-sm"],
    [9, 17, "text-sm"],
    [10, 19, "text-xs"],
    [11, 20, "text-xs"],
  ])("total com %i digitos inteiros (%i caracteres) usa %s, nunca trunca e cabe no furo (len x 0,6 x px <= 149)", (digits, len, expected) => {
    const total = totalWithDigits(digits);
    expect(formatBRL(total).length).toBe(len);
    const { container } = render(<CategoryDonut distribution={{ ...distribution(), total }} />);
    const money = totalElement(container);
    expect(nbsp(money.textContent!)).toBe(nbsp(formatBRL(total)));
    const size = effectiveSize(money)!;
    expect(size).toBe(expected);
    expect(len * 0.6 * PX[size]).toBeLessThanOrEqual(HOLE);
    for (let el: Element | null = money; el && !el.classList.contains("absolute"); el = el.parentElement) {
      expect(classes(el)).not.toContain("truncate");
      expect(classes(el)).not.toContain("text-ellipsis");
      expect(classes(el)).not.toContain("overflow-hidden");
    }
    expect(classes(money)).toContain("whitespace-nowrap");
  });

  it("fronteiras: a regra fisica vale para todo comprimento de 13 a 20 com a classe escolhida pelo componente", () => {
    // Comprimentos 14 e 18 nao ocorrem com formatBRL; a regra e conferida sobre os alcancaveis e nas fronteiras.
    const rule = (len: number) => (len <= 13 ? "text-lg" : len <= 15 ? "text-base" : len <= 17 ? "text-sm" : "text-xs");
    for (let len = 13; len <= 17; len++) expect(len * 0.6 * PX[rule(len)], `len ${len}`).toBeLessThanOrEqual(HOLE);
    expect(13 * 0.6 * 18).toBeLessThanOrEqual(HOLE);
    expect(14 * 0.6 * 18).toBeGreaterThan(HOLE);
    expect(15 * 0.6 * 16).toBeLessThanOrEqual(HOLE);
    expect(16 * 0.6 * 16).toBeGreaterThan(HOLE);
    expect(17 * 0.6 * 14).toBeLessThanOrEqual(HOLE);
    expect(18 * 0.6 * 14).toBeGreaterThan(HOLE);
    expect(20 * 0.6 * 12).toBeLessThanOrEqual(HOLE);
  });

  it("rotulo 'Total de despesas' continua text-xs", () => {
    render(<CategoryDonut distribution={distribution()} />);
    expect(screen.getByText("Total de despesas")).toHaveClass("text-xs");
  });
});

describe("DonutTooltip: nome longo (design, recomendacao aprovada)", () => {
  it("o nome da categoria quebra com break-words e o tooltip mantem max-w-64", () => {
    const { container } = render(
      <DonutTooltip active payload={[{ payload: { key: "k", category: LONG, total: "100.00", percentage: "100.00" } as never }]} />,
    );
    const name = screen.getByText(LONG);
    expect(name).toHaveClass("break-words");
    expect(container.firstElementChild).toHaveClass("max-w-64");
  });
});

describe("DonutSkeleton / ChartSkeleton no novo arranjo (RF05, B2, ADR 0012 5.3)", () => {
  it("mantem o anuncio de carregamento", () => {
    render(<DonutSkeleton />);
    expect(screen.getByText("Carregando despesas por categoria")).toBeInTheDocument();
  });

  it("rosca de 220 px (nao mais 200) dentro de um contêiner @container com o mesmo arranjo do donut real", () => {
    const { container } = render(<DonutSkeleton />);
    expect(container.innerHTML).not.toContain("h-[200px]");
    const ring = container.querySelector('[class*="h-[220px]"]')!;
    expect(ring).not.toBeNull();
    expect(classes(ring)).toEqual(expect.arrayContaining(["w-[220px]", "rounded-full", "shrink-0"]));
    const arrangement = ring.parentElement!;
    expect(classes(arrangement)).toEqual(expect.arrayContaining(["flex", "flex-col", "items-center", "gap-4", "@3xl:flex-row", "@3xl:justify-center", "@3xl:gap-8"]));
    expect(containerOf(arrangement)).not.toBeNull();
  });

  it("legenda do skeleton com 6 linhas de 28 px, max-w-md, igual ao maximo real", () => {
    const { container } = render(<DonutSkeleton />);
    const rows = container.querySelectorAll('[class*="max-w-md"] > .skeleton.h-7');
    expect(rows).toHaveLength(6);
    const legendBox = rows[0].parentElement!;
    expect(classes(legendBox)).toEqual(expect.arrayContaining(["w-full", "min-w-0", "max-w-md", "@3xl:flex-1"]));
  });

  it("mesmo padding do ChartCard (p-4 md:p-5) nos dois skeletons", () => {
    const { container: a } = render(<DonutSkeleton />);
    expect(a.firstElementChild).toHaveClass("p-4", "md:p-5");
    const { container: b } = render(<ChartSkeleton label="x" />);
    expect(b.firstElementChild).toHaveClass("p-4", "md:p-5");
  });

  it("ChartSkeleton usa as alturas reais das barras (260 / md 280 / lg 320)", () => {
    const { container } = render(<ChartSkeleton label="x" />);
    const body = container.querySelector('[class*="h-[260px]"]')!;
    expect(body).not.toBeNull();
    expect(classes(body)).toEqual(expect.arrayContaining(["h-[260px]", "md:h-[280px]", "lg:h-[320px]"]));
  });

  it("chart-layout e a fonte unica da altura das barras", () => {
    expect(MONTHLY_CHART_HEIGHT).toBe("h-[260px] md:h-[280px] lg:h-[320px]");
    expect(DONUT_CONTAINER).toBe("@container");
  });

  it('chart-layout nao tem "use client" (senao os skeletons, Server Components, recebem client references)', () => {
    const source = readFileSync(join(__dirname, "chart-layout.ts"), "utf8");
    expect(source).not.toMatch(/^\s*["']use client["']/m);
  });

  it("os dois skeletons tem placeholder de cabecalho igual ao figcaption do ChartCard (sem CLS)", () => {
    for (const ui of [<ChartSkeleton key="a" label="x" />, <DonutSkeleton key="b" />]) {
      const { container, unmount } = render(ui);
      const header = container.querySelector('[data-testid="chart-header-skeleton"]')!;
      expect(header).not.toBeNull();
      expect(header.className).toBe(CHART_HEADER_SKELETON);
      expect(classes(header)).toEqual(expect.arrayContaining(["flex", "flex-wrap", "items-start", "justify-between", "gap-3"]));
      expect(header.querySelector(".skeleton.h-7")).not.toBeNull();
      expect(header.querySelector(".skeleton.h-5")).not.toBeNull();
      // 28 + 20 = 48px, como o <div> do figcaption (sem gap entre titulo e subtitulo)
      const textBlock = header.querySelector(".skeleton.h-7")!.parentElement!;
      expect(classes(textBlock).some((c) => /^(gap|space-y)-/.test(c))).toBe(false);
      // alternador .segmented: botao de 44px + 1px de borda em cima e embaixo
      expect(header.querySelector('.skeleton[class*="h-[46px]"]')).not.toBeNull();
      unmount();
    }
  });
});
