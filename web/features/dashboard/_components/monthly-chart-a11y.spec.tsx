import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MonthlySeries, TotalsDto } from "@/lib/api/types";

vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal<typeof import("recharts")>();
  const React = await import("react");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => (
      <div style={{ width: 800, height: 300 }}>{React.cloneElement(children, { width: 800, height: 300 })}</div>
    ),
  };
});
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { MonthlyChart } from "./monthly-chart";

const t = (income: string): TotalsDto => ({ income, expenses: { total: "300.00", paid: "100.00", pending: "200.00" }, balance: { realized: "100.00", projected: "-100.00" } });
const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const series: MonthlySeries = { from: "2025-12", to: "2026-11", points: months.map((month) => ({ month, totals: t("200.00") })) };

function setup(width: number) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(12 * 56);
  Element.prototype.scrollBy = vi.fn();
}
beforeEach(() => undefined);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MonthlyChart: mes selecionado com faixa fixa --chart-cursor (F4, design 5.5)", () => {
  it.each([
    ["largo (>= 560px)", 900],
    ["estreito (< 560px, area rolavel)", 400],
  ])("modo %s: a faixa do mes selecionado existe SEM hover/foco", (_name, width) => {
    setup(width);
    const { container } = render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    expect(container.innerHTML).toContain("--chart-cursor");
  });

  it("a faixa fica atras das series (aparece antes das barras no DOM)", () => {
    setup(900);
    const { container } = render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    const html = container.innerHTML;
    const band = html.indexOf("--chart-cursor");
    const firstSeries = html.indexOf("recharts-bar-rectangle");
    expect(band).toBeGreaterThanOrEqual(0);
    expect(firstSeries).toBeGreaterThan(band);
  });
});

describe("MonthlyChart: uma unica parada de Tab por grafico (F5a)", () => {
  it.each([
    ["largo", 900],
    ["estreito", 400],
  ])("modo %s: exatamente um elemento com tabindex=0 na area do grafico", (_name, width) => {
    setup(width);
    const { container } = render(<MonthlyChart series={series} selectedMonth="2026-11" />);
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(screen.getAllByRole("group", { name: /Gráfico de evolução mensal/ })).toHaveLength(1);
  });
});
