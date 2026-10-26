import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryDistribution, MonthlySeries, TotalsDto } from "@/lib/api/types";

const seen = vi.hoisted(() => ({ bar: [] as unknown[], pie: [] as unknown[] }));
vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal<typeof import("recharts")>();
  const React = await import("react");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => (
      <div style={{ width: 800, height: 300 }}>{React.cloneElement(children, { width: 800, height: 300 })}</div>
    ),
    Bar: (props: { isAnimationActive?: boolean }) => {
      seen.bar.push(props.isAnimationActive);
      return React.createElement(original.Bar, props as never);
    },
    Pie: (props: { isAnimationActive?: boolean }) => {
      seen.pie.push(props.isAnimationActive);
      return React.createElement(original.Pie, props as never);
    },
  };
});
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { CategoryDonut } from "./category-donut";
import { MonthlyChart } from "./monthly-chart";

const t = (income: string): TotalsDto => ({ income, expenses: { total: "300.00", paid: "100.00", pending: "200.00" }, balance: { realized: "100.00", projected: "-100.00" } });
const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const series: MonthlySeries = { from: "2025-12", to: "2026-11", points: months.map((month) => ({ month, totals: t("200.00") })) };
const dist: CategoryDistribution = {
  month: "2026-11",
  total: "300.00",
  items: [
    { category: "Moradia", total: "200.00", percentage: "66.67" },
    { category: "Lazer", total: "100.00", percentage: "33.33" },
  ],
};

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") ? reduce : false, addEventListener() {}, removeEventListener() {} }));
}
function mockWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(12 * 56);
}

beforeEach(() => {
  seen.bar.length = 0;
  seen.pie.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MonthlyChart em contêiner estreito (D15): eixo Y fixo + barras rolaveis", () => {
  it("< 560px: coluna fixa do eixo (fora da area rolavel), area com >= 44px por mes, botoes 44x44 e dica de rolagem", () => {
    mockReducedMotion(false);
    mockWidth(400);
    Element.prototype.scrollBy = vi.fn();
    render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    const axis = screen.getByTestId("fixed-axis");
    const scroll = screen.getByTestId("scroll-area");
    expect(scroll.contains(axis)).toBe(false);
    expect(axis.className).toContain("shrink-0");
    expect(scroll).toHaveAttribute("tabindex", "0");
    expect(scroll.className).toContain("overflow-x-auto");
    const content = scroll.firstElementChild as HTMLElement;
    expect(parseInt(content.style.width, 10) / 12).toBeGreaterThanOrEqual(44);
    expect(screen.getByText("Deslize para ver os 12 meses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meses anteriores" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meses recentes" })).toBeInTheDocument();
  });

  it("abre rolado no mes selecionado e os botoes rolam em passos de meses", async () => {
    mockReducedMotion(true);
    mockWidth(400);
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    const scroll = screen.getByTestId("scroll-area");
    expect(scroll.scrollLeft).toBe(12 * 56 - 400); // ultimo mes (selecionado) visivel
    // no fim da serie: "Meses recentes" desabilitado, "Meses anteriores" ativo
    expect(screen.getByRole("button", { name: "Meses recentes" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("button", { name: "Meses anteriores" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -3 * 56, behavior: "auto" });
    scroll.scrollLeft = 0;
    fireEvent.scroll(scroll);
    expect(screen.getByRole("button", { name: "Meses anteriores" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("button", { name: "Meses recentes" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 3 * 56, behavior: "auto" });
  });

  it(">= 560px: grafico unico, sem coluna fixa nem botoes de rolagem", () => {
    mockReducedMotion(false);
    mockWidth(900);
    render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    expect(screen.queryByTestId("fixed-axis")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Meses anteriores" })).not.toBeInTheDocument();
  });
});

describe("modo estreito: eixo fixo e barras com a MESMA altura de plotagem (regressao)", () => {
  const num = (v: string | null) => Number(v);
  it("o y do tick 'R$ 0' no eixo fixo e igual ao y da linha do zero na area rolavel", () => {
    mockReducedMotion(true);
    mockWidth(400);
    Element.prototype.scrollBy = vi.fn();
    render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    const axisSvg = screen.getByTestId("fixed-axis").querySelector("svg")!;
    const barsSvg = screen.getByTestId("scroll-area").querySelector("svg")!;
    const zeroTick = [...axisSvg.querySelectorAll("text")].find((t) => t.textContent === "R$ 0")!;
    const zeroLine = barsSvg.querySelector('line[stroke="var(--chart-zero-line)"]')!;
    expect(zeroTick).toBeTruthy();
    expect(zeroLine).toBeTruthy();
    expect(num(zeroTick.getAttribute("y"))).toBeCloseTo(num(zeroLine.getAttribute("y1")), 1);
    expect(num(zeroLine.getAttribute("y1"))).toBe(num(zeroLine.getAttribute("y2")));
  });
  it("o eixo fixo nao desenha rotulos de mes nem tem margem direita negativa; defs so onde ha barras", () => {
    mockReducedMotion(true);
    mockWidth(400);
    Element.prototype.scrollBy = vi.fn();
    render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    const axisSvg = screen.getByTestId("fixed-axis").querySelector("svg")!;
    expect(axisSvg.textContent).not.toMatch(/nov\/26/);
    expect(axisSvg.querySelector("pattern")).toBeNull();
    const barsSvg = screen.getByTestId("scroll-area").querySelector("svg")!;
    const id = barsSvg.querySelector("pattern")!.id;
    expect(id).toMatch(/^hatch-[\w-]+$/);
    expect(barsSvg.innerHTML).toContain(`url(#${id})`);
  });
  it("mes selecionado fora da serie cai no ultimo mes; ResizeObserver e desconectado ao desmontar", () => {
    mockReducedMotion(true);
    mockWidth(400);
    Element.prototype.scrollBy = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = disconnect; });
    const { unmount } = render(<MonthlyChart series={series} selectedMonth="2030-01" />);
    expect(screen.getByTestId("scroll-area").scrollLeft).toBe(12 * 56 - 400);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe("animacoes dos graficos so sem prefers-reduced-motion (CA87)", () => {
  it("sem preferencia: Bar e Pie animam", () => {
    mockReducedMotion(false);
    mockWidth(900);
    render(
      <>
        <MonthlyChart series={series} selectedMonth="2026-11" />
        <CategoryDonut distribution={dist} />
      </>,
    );
    expect(seen.bar.length).toBeGreaterThan(0);
    expect(seen.bar.every((v) => v === true)).toBe(true);
    expect(seen.pie.every((v) => v === true)).toBe(true);
  });
  it("com reduce: nenhuma animacao", () => {
    mockReducedMotion(true);
    mockWidth(900);
    render(
      <>
        <MonthlyChart series={series} selectedMonth="2026-11" />
        <CategoryDonut distribution={dist} />
      </>,
    );
    expect(seen.bar.every((v) => v === false)).toBe(true);
    expect(seen.pie.every((v) => v === false)).toBe(true);
  });
});

describe("donut: destaque da fatia pela legenda interativa (hover/foco)", () => {
  it("hover e foco na legenda marcam a fatia com contorno --text e o item com anel; sair desfaz", async () => {
    mockReducedMotion(true);
    const { container } = render(<CategoryDonut distribution={dist} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("tabindex", "0");
    expect(container.querySelector('[stroke="var(--text)"]')).toBeNull();
    await userEvent.hover(items[0]);
    expect(items[0]).toHaveAttribute("data-active", "true");
    expect(items[0].className).toContain("ring-2");
    expect(container.querySelectorAll('[stroke="var(--text)"]').length).toBeGreaterThan(0);
    await userEvent.unhover(items[0]);
    expect(items[0]).toHaveAttribute("data-active", "false");
    expect(container.querySelector('[stroke="var(--text)"]')).toBeNull();
    act(() => items[1].focus());
    expect(items[1]).toHaveAttribute("data-active", "true");
    act(() => items[1].blur());
    expect(items[1]).toHaveAttribute("data-active", "false");
  });
});
