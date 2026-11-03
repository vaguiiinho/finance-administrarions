"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { useAppMode } from "@/components/app-mode";
import { Money } from "@/components/ui/money";
import { monthLongPtBR } from "@/lib/dates/format";
import { formatBRL } from "@/lib/money/decimal";
import { usePrefersReducedMotion } from "@/lib/hooks/reduced-motion";
import { formatPercent, groupCategories, type DonutSlice } from "@/lib/dashboard/chart-data";
import type { CategoryDistribution } from "@/lib/api/types";
import { DONUT_ARRANGEMENT, DONUT_CONTAINER, DONUT_LEGEND, DONUT_RING } from "./chart-layout";
import { ChartCard, type ChartView } from "./chart-card";

const COLORS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];
const colorOf = (index: number) => `var(${COLORS[Math.min(index, COLORS.length - 1)]})`;

export function DonutTooltip({ active, payload }: { active?: boolean; payload?: { payload: DonutSlice }[] }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="flex max-w-64 flex-col gap-1 rounded-lg border border-tooltip-border bg-tooltip p-3 text-sm shadow-lg">
      <p className="break-words font-display font-semibold text-text">{slice.category}</p>
      <p className="text-text">
        <Money value={slice.total} /> · {formatPercent(slice.percentage)}
      </p>
      {slice.members ? <p className="text-muted">{slice.members.join(", ")}</p> : null}
    </div>
  );
}

/** Despesas por categoria (RF17, D4): ate 5 categorias + "Outras", legenda propria, centro com o total e tabela alternativa. */
export function CategoryDonut({ distribution }: { distribution: CategoryDistribution }) {
  const { basePath } = useAppMode();
  const [view, setView] = useState<ChartView>("chart");
  const [active, setActive] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const slices = useMemo(() => groupCategories(distribution.items), [distribution.items]);
  const monthLabel = monthLongPtBR(distribution.month);
  const empty = distribution.items.length === 0;
  const geometry = useMemo(() => slices.map((s) => ({ ...s, value: Number(s.total) })), [slices]);

  const totalLength = formatBRL(distribution.total).length;
  const totalSize = totalLength <= 13 ? "text-lg" : totalLength <= 15 ? "text-base" : totalLength <= 17 ? "text-sm" : "text-xs";

  const description = empty
    ? `Nenhuma despesa em ${monthLabel}.`
    : `Despesas por categoria em ${monthLabel}, total ${formatBRL(distribution.total)}. ${slices.map((s) => `${s.category} ${formatBRL(s.total)}, ${formatPercent(s.percentage)}`).join("; ")}.`;

  return (
    <ChartCard title="Despesas por categoria" subtitle={monthLabel} view={view} onViewChange={setView} hideToggle={empty} description={description}>
      {empty ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-display text-2xl font-semibold text-text">
            <Money value="0.00" />
          </p>
          <p className="text-muted">Nenhuma despesa em {monthLabel}</p>
          <Link href={`${basePath}/entries?month=${distribution.month}`} className="btn">
            Ir para lançamentos
          </Link>
        </div>
      ) : view === "table" ? (
        <div tabIndex={0} role="group" aria-label="Tabela de despesas por categoria" className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Despesas por categoria em {monthLabel}</caption>
            <thead className="text-left text-muted">
              <tr className="border-b border-border-strong">
                <th scope="col" className="px-2 py-2 font-medium">Categoria</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Valor</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Percentual</th>
              </tr>
            </thead>
            <tbody>
              {distribution.items.map((item) => (
                <tr key={item.category} className="border-b border-border">
                  <th scope="row" className="px-2 py-2 text-left font-medium text-text">{item.category}</th>
                  <td className="px-2 py-2 text-right text-text"><Money value={item.total} /></td>
                  <td className="px-2 py-2 text-right text-text">{formatPercent(item.percentage)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="px-2 py-2 text-left font-semibold text-text">Total</th>
                <td className="px-2 py-2 text-right font-semibold text-text"><Money value={distribution.total} /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className={DONUT_CONTAINER}>
          <div className={DONUT_ARRANGEMENT}>
            <div className={`relative ${DONUT_RING}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie data={geometry} dataKey="value" nameKey="category" innerRadius="68%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="var(--chart-sep)" strokeWidth={2} isAnimationActive={!reduced} animationDuration={250} onMouseEnter={(_, index) => setActive(index)} onMouseLeave={() => setActive(null)}>
                    {geometry.map((slice, index) => (
                      <Cell key={slice.key} fill={colorOf(index)} data-active={active === index} stroke={active === index ? "var(--text)" : "var(--chart-sep)"} strokeWidth={active === index ? 3 : 2} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} isAnimationActive={false} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-muted">Total de despesas</span>
                <span className="display-num font-semibold text-text">
                  <Money value={distribution.total} className={totalSize} />
                </span>
              </div>
            </div>
            <ul className={DONUT_LEGEND}>
              {slices.map((slice, index) => (
                <li
                  key={slice.key}
                  tabIndex={0}
                  aria-label={`${slice.category}, ${formatBRL(slice.total)}, ${formatPercent(slice.percentage)}`}
                  data-active={active === index}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-1 py-1 ${active === index ? "bg-surface-2 ring-2 ring-text" : ""}`}
                >
                  <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: colorOf(index) }} />
                  <span className="min-w-0 flex-1 basis-0 truncate text-text" title={slice.members?.join(", ")}>
                    {slice.category}
                  </span>
                  <Money value={slice.total} className="shrink-0 whitespace-nowrap text-text" />
                  <span className="min-w-14 shrink-0 whitespace-nowrap text-right text-muted">{formatPercent(slice.percentage)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
