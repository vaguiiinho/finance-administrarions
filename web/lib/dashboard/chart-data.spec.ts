import { describe, expect, it } from "vitest";
import type { TotalsDto } from "@/lib/api/types";
import { formatAxisTick, formatPercent, groupCategories, isSeriesEmpty, toChartPoints } from "./chart-data";

const totals = (income: string, paid: string, pending: string, realized: string, projected: string): TotalsDto => ({
  income,
  expenses: { total: "0.00", paid, pending },
  balance: { realized, projected },
});

describe("toChartPoints", () => {
  it("mantem as strings da API e usa Number so como geometria", () => {
    const [p] = toChartPoints([{ month: "2026-10", totals: totals("5000.00", "3000.00", "2500.00", "2000.00", "-500.00") }]);
    expect(p.label).toBe("out/26");
    expect(p.incomeValue).toBe(5000);
    expect(p.projectedValue).toBe(-500);
    expect(p.totals.balance.projected).toBe("-500.00");
  });
});

describe("isSeriesEmpty", () => {
  const zero = totals("0.00", "0.00", "0.00", "0.00", "0.00");
  it("12 meses zerados", () => {
    expect(isSeriesEmpty([{ month: "2026-09", totals: zero }, { month: "2026-10", totals: zero }])).toBe(true);
  });
  it("qualquer valor torna a serie nao vazia", () => {
    expect(isSeriesEmpty([{ month: "2026-09", totals: zero }, { month: "2026-10", totals: totals("0.01", "0.00", "0.00", "0.00", "0.00") }])).toBe(false);
  });
});

describe("formatAxisTick (design 1.7)", () => {
  it.each([
    [0, "R$ 0"],
    [500, "R$ 500"],
    [1000, "R$ 1 mil"],
    [1500, "R$ 1,5 mil"],
    [-500, "-R$ 500"],
    [-2500, "-R$ 2,5 mil"],
    [2_000_000, "R$ 2 mi"],
  ])("%d -> %s", (value, expected) => {
    expect(formatAxisTick(value)).toBe(expected);
  });
});

describe("groupCategories (D4): ate 5 + Outras", () => {
  const item = (category: string, total: string, percentage: string) => ({ category, total, percentage });
  it("ate 5 categorias nao agrupa", () => {
    const out = groupCategories([item("A", "10.00", "50.00"), item("B", "10.00", "50.00")]);
    expect(out.map((s) => s.category)).toEqual(["A", "B"]);
  });
  it("soma o resto em Outras por centavos", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((c, i) => item(c, `${10 - i}.10`, "10.05"));
    const out = groupCategories(items);
    expect(out).toHaveLength(6);
    expect(out[5]).toMatchObject({ category: "Outras", total: "9.20", percentage: "20.10", members: ["F", "G"] });
  });
});

describe("formatPercent", () => {
  it.each([
    ["75.00", "75%"],
    ["33.33", "33,33%"],
    ["12.50", "12,5%"],
    ["100.00", "100%"],
  ])("%s -> %s", (input, expected) => {
    expect(formatPercent(input)).toBe(expected);
  });
});
