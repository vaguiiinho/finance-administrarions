import { monthLabelPtBR } from "@/lib/dates/format";
import { sumDecimals, toCents } from "@/lib/money/decimal";
import type { CategoryDistribution, MonthlySeries, TotalsDto } from "@/lib/api/types";

/**
 * Dados dos graficos (ADR 9.4): as strings da API seguem intactas para tooltip, legenda e tabela; `Number()` so
 * existe nos campos `*Value`, usados unicamente como GEOMETRIA (altura de barra/linha).
 */
export interface ChartPoint {
  month: string;
  label: string;
  incomeValue: number;
  paidValue: number;
  pendingValue: number;
  realizedValue: number;
  projectedValue: number;
  totals: TotalsDto;
}

export function toChartPoints(points: MonthlySeries["points"]): ChartPoint[] {
  return points.map(({ month, totals }) => ({
    month,
    label: monthLabelPtBR(month),
    incomeValue: Number(totals.income),
    paidValue: Number(totals.expenses.paid),
    pendingValue: Number(totals.expenses.pending),
    realizedValue: Number(totals.balance.realized),
    projectedValue: Number(totals.balance.projected),
    totals,
  }));
}

export function isSeriesEmpty(points: MonthlySeries["points"]): boolean {
  return points.every(({ totals }) => [totals.income, totals.expenses.total, totals.expenses.paid, totals.expenses.pending].every((v) => toCents(v) === 0n));
}

/** Tick compacto do eixo Y: "R$ 0", "R$ 1,5 mil", "-R$ 500", "R$ 2 mi". Aplicado so a ticks GERADOS pela escala. */
export function formatAxisTick(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const compact = (n: number) => n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1_000_000) return `${sign}R$ ${compact(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sign}R$ ${compact(abs / 1_000)} mil`;
  return `${sign}R$ ${Math.round(abs)}`;
}

export interface DonutSlice {
  key: string;
  category: string;
  total: string;
  percentage: string;
  /** Categorias agrupadas em "Outras" */
  members?: string[];
}

export const OTHERS_LABEL = "Outras";

/** Ate 5 categorias + "Outras" (D4); a ordem decrescente vem da API. Somas por centavos (BigInt). */
export function groupCategories(items: CategoryDistribution["items"], max = 5): DonutSlice[] {
  const head = items.slice(0, max).map((i) => ({ key: i.category, ...i }));
  const rest = items.slice(max);
  if (rest.length === 0) return head;
  return [
    ...head,
    {
      key: OTHERS_LABEL,
      category: OTHERS_LABEL,
      total: sumDecimals(rest.map((i) => i.total)),
      percentage: sumDecimals(rest.map((i) => i.percentage)),
      members: rest.map((i) => i.category),
    },
  ];
}

/** "75.00" -> "75%"; "33.33" -> "33,33%" (percentual da API, so troca de separador). */
export function formatPercent(percentage: string): string {
  const [int, frac = ""] = percentage.split(".");
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${int},${trimmed}%` : `${int}%`;
}
