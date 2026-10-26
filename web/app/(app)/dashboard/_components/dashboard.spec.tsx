import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockedRecharts } from "@/test/helpers/recharts-mock";
import type { CategoryDistribution, MonthlySeries, TotalsDto } from "@/lib/api/types";
import { CategoryDonut, DonutTooltip } from "./category-donut";
import { MonthlyChart, MonthlyTooltip } from "./monthly-chart";
import { ChartSkeleton, DonutSkeleton } from "./dashboard-skeletons";

vi.mock("recharts", async (importOriginal) => mockedRecharts(await importOriginal<typeof import("recharts")>()));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");
const totals = (income: string, paid: string, pending: string, realized: string, projected: string): TotalsDto => ({
  income,
  expenses: { total: (Number(paid) + Number(pending)).toFixed(2), paid, pending },
  balance: { realized, projected },
});
const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const series = (empty = false): MonthlySeries => ({
  from: "2025-12",
  to: "2026-11",
  points: months.map((month) => ({ month, totals: empty ? totals("0.00", "0.00", "0.00", "0.00", "0.00") : totals("5000.00", "3000.00", "2500.00", "2000.00", "-500.00") })),
});

describe("MonthlyChart (RF16, D3)", () => {
  it("renderiza serie com legenda, descricao textual e SVG somente com var(--token) (CA86)", () => {
    const { container } = render(<MonthlyChart series={series()} selectedMonth="2026-11" />);
    expect(screen.getByRole("heading", { name: "Evolução mensal" })).toBeInTheDocument();
    expect(screen.getByText("dez/25 a nov/26")).toBeInTheDocument();
    for (const label of ["Receitas", "Despesas pagas", "Despesas pendentes", "Saldo realizado", "Saldo previsto"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(nbsp(screen.getByRole("figure").getAttribute("aria-describedby") && document.getElementById(screen.getByRole("figure").getAttribute("aria-describedby")!)!.textContent)).toContain("saldo previsto -R$ 500,00");
    const html = container.innerHTML;
    expect(html).toMatch(/var\(--chart-income\)/);
    expect(html.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(html).not.toMatch(/rgba?\(/);
    expect(screen.queryByText(/Sem lançamentos de/)).not.toBeInTheDocument();
  });

  it("serie zerada mostra a pilula 'Sem lançamentos de dez/25 a nov/26'", () => {
    render(<MonthlyChart series={series(true)} selectedMonth="2026-11" />);
    expect(screen.getByText("Sem lançamentos de dez/25 a nov/26")).toBeInTheDocument();
  });

  it("alternador Grafico | Tabela mostra 12 meses com as 7 colunas", async () => {
    render(<MonthlyChart series={series()} selectedMonth="2026-11" />);
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
    expect(nbsp(within(table).getAllByRole("row")[1].textContent)).toContain("-R$ 500,00");
    await userEvent.click(screen.getByRole("button", { name: "Gráfico" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("tooltip usa tokens (fundo e borda) e mostra as seis linhas com sinal textual (CA86)", () => {
    const point = { month: "2026-10", totals: totals("5000.00", "3000.00", "2500.00", "2000.00", "-500.00") };
    const { container } = render(<MonthlyTooltip active payload={[{ payload: point as never }]} />);
    const tip = container.firstElementChild as HTMLElement;
    expect(tip.className).toContain("bg-tooltip");
    expect(tip.className).toContain("border-tooltip-border");
    expect(tip).toHaveTextContent("outubro de 2026");
    expect(tip).toHaveTextContent("Positivo");
    expect(tip).toHaveTextContent("Negativo");
    expect(container.innerHTML.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|(?<![\w-])(?:white|black)(?![\w-])/g)).toBeNull();
  });

  it("tooltip inativo nao renderiza", () => {
    const { container } = render(<MonthlyTooltip active={false} payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CategoryDonut (RF17, D4)", () => {
  const dist = (n: number): CategoryDistribution => ({
    month: "2026-10",
    total: `${n * 100}.00`,
    items: Array.from({ length: n }, (_, i) => ({ category: `Cat ${i + 1}`, total: "100.00", percentage: (100 / n).toFixed(2) })),
  });

  it("ate 5 + Outras na legenda, centro com o total e tooltip de 'Outras' lista as agrupadas", () => {
    render(<CategoryDonut distribution={dist(7)} />);
    expect(screen.getByText("Outras")).toBeInTheDocument();
    expect(nbsp(screen.getByText("Total de despesas").nextElementSibling!.textContent)).toBe("R$ 700,00");
    const { container } = render(<DonutTooltip active payload={[{ payload: { key: "Outras", category: "Outras", total: "200.00", percentage: "28.58", members: ["Cat 6", "Cat 7"] } }]} />);
    expect(container.firstElementChild!.className).toContain("bg-tooltip");
    expect(container).toHaveTextContent("Cat 6, Cat 7");
    expect(container).toHaveTextContent("28,58%");
  });

  it("tabela alternativa lista TODAS as categorias com total", async () => {
    render(<CategoryDonut distribution={dist(7)} />);
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1 + 7 + 1);
  });

  it("mes sem despesas: R$ 0,00, mensagem, link para lancamentos e sem alternador", () => {
    render(<CategoryDonut distribution={{ month: "2026-10", total: "0.00", items: [] }} />);
    expect(screen.getByText("Nenhuma despesa em outubro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para lançamentos" })).toHaveAttribute("href", "/entries?month=2026-10");
    expect(screen.queryByRole("button", { name: "Tabela" })).not.toBeInTheDocument();
  });

  it("tooltip inativo nao renderiza", () => {
    const { container } = render(<DonutTooltip active={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("skeletons do dashboard", () => {
  it("anunciam o carregamento", () => {
    render(
      <>
        <ChartSkeleton label="Carregando evolução mensal" />
        <DonutSkeleton />
      </>,
    );
    expect(screen.getByText("Carregando evolução mensal")).toBeInTheDocument();
    expect(screen.getByText("Carregando despesas por categoria")).toBeInTheDocument();
  });
});

describe("CA86 - tooltip e graficos seguem o tema por tokens", () => {
  const css = readFileSync(resolve(__dirname, "../../../globals.css"), "utf8");
  it("utilitarios de tooltip apontam para os tokens do tema (nao para cores fixas)", () => {
    expect(css).toMatch(/--color-tooltip:\s*var\(--tooltip-bg\)/);
    expect(css).toMatch(/--color-tooltip-border:\s*var\(--tooltip-border\)/);
  });
});
