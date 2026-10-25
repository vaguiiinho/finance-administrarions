"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Money } from "@/components/ui/money";
import { SignIndicator } from "@/components/ui/status";
import { monthLabelPtBR, monthLongPtBR } from "@/lib/dates/format";
import { formatBRL } from "@/lib/money/decimal";
import { formatAxisTick, isSeriesEmpty, toChartPoints, type ChartPoint } from "@/lib/dashboard/chart-data";
import type { MonthlySeries } from "@/lib/api/types";
import { ChartCard, type ChartView } from "./chart-card";

const MONTH_WIDTH = 56;
const AXIS_WIDTH = 76;

function Legend() {
  const items = [
    { label: "Receitas", swatch: "bg-[var(--chart-income)]" },
    { label: "Despesas pagas", swatch: "bg-[var(--chart-paid)]" },
    { label: "Despesas pendentes", swatch: "bg-[var(--chart-pending)]", hatched: true },
    { label: "Saldo realizado", line: "solid" as const, color: "var(--chart-balance-realized)" },
    { label: "Saldo previsto", line: "dashed" as const, color: "var(--chart-balance-projected)" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.line ? (
            <svg aria-hidden="true" width="22" height="10" viewBox="0 0 22 10">
              <line x1="0" y1="5" x2="22" y2="5" style={{ stroke: item.color }} strokeWidth="2.5" strokeDasharray={item.line === "dashed" ? "6 4" : undefined} />
            </svg>
          ) : (
            <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${item.swatch}`} />
          )}
          {item.label}
          {item.hatched ? <span className="sr-only"> (hachurado)</span> : null}
        </li>
      ))}
    </ul>
  );
}

function TooltipRow({ marker, label, children }: { marker?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        {marker}
        {label}
      </span>
      <span className="flex items-center gap-2 text-text">{children}</span>
    </div>
  );
}

export function MonthlyTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { month, totals } = payload[0].payload;
  const dot = (cssVar: string) => <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(${cssVar})` }} />;
  return (
    <div className="flex min-w-60 flex-col gap-1 rounded-lg border border-tooltip-border bg-tooltip p-3 text-sm shadow-lg">
      <p className="font-display font-semibold text-text">{monthLongPtBR(month)}</p>
      <TooltipRow marker={dot("--chart-income")} label="Receitas">
        <Money value={totals.income} />
      </TooltipRow>
      <TooltipRow marker={dot("--chart-paid")} label="Despesas pagas">
        <Money value={totals.expenses.paid} />
      </TooltipRow>
      <TooltipRow marker={dot("--chart-pending")} label="Despesas pendentes">
        <Money value={totals.expenses.pending} />
      </TooltipRow>
      <TooltipRow label="Total de despesas">
        <Money value={totals.expenses.total} />
      </TooltipRow>
      <TooltipRow marker={dot("--chart-balance-realized")} label="Saldo realizado">
        <Money value={totals.balance.realized} />
        <SignIndicator value={totals.balance.realized} />
      </TooltipRow>
      <TooltipRow marker={dot("--chart-balance-projected")} label="Saldo previsto">
        <Money value={totals.balance.projected} />
        <SignIndicator value={totals.balance.projected} />
      </TooltipRow>
    </div>
  );
}

function MonthTick({ x, y, payload, selected }: { x?: number | string; y?: number | string; payload?: { value: string }; selected: string }) {
  const isSelected = payload?.value === selected;
  return (
    <text x={x} y={Number(y ?? 0) + 14} textAnchor="middle" fontSize={12} fontWeight={isSelected ? 700 : 400} style={{ fill: isSelected ? "var(--text)" : "var(--chart-axis)" }}>
      {payload?.value}
    </text>
  );
}

function MonthlyTable({ data }: { data: ChartPoint[] }) {
  return (
    <div tabIndex={0} role="group" aria-label="Tabela da evolução mensal" className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Evolução mensal: receitas, despesas e saldos</caption>
        <thead className="text-left text-muted">
          <tr className="border-b border-border-strong">
            <th scope="col" className="sticky left-0 bg-surface px-2 py-2 font-medium">Mês</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Receitas</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Despesas pagas</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Despesas pendentes</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Total de despesas</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Saldo realizado</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Saldo previsto</th>
          </tr>
        </thead>
        <tbody>
          {data.map(({ month, totals }) => (
            <tr key={month} className="border-b border-border">
              <th scope="row" className="sticky left-0 bg-surface px-2 py-2 text-left font-medium text-text">{monthLongPtBR(month)}</th>
              <td className="px-2 py-2 text-right text-text"><Money value={totals.income} /></td>
              <td className="px-2 py-2 text-right text-text"><Money value={totals.expenses.paid} /></td>
              <td className="px-2 py-2 text-right text-text"><Money value={totals.expenses.pending} /></td>
              <td className="px-2 py-2 text-right text-text"><Money value={totals.expenses.total} /></td>
              <td className="px-2 py-2 text-right text-text"><Money value={totals.balance.realized} /></td>
              <td className="px-2 py-2 text-right text-text"><Money value={totals.balance.projected} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Evolucao mensal (RF16, D3): despesas empilhadas (pago na base, pendente com hachura) + receitas + duas linhas de saldo. */
export function MonthlyChart({ series, selectedMonth }: { series: MonthlySeries; selectedMonth: string }) {
  const [view, setView] = useState<ChartView>("chart");
  const data = useMemo(() => toChartPoints(series.points), [series.points]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const empty = isSeriesEmpty(series.points);
  const selectedLabel = monthLabelPtBR(selectedMonth);
  const subtitle = `${monthLabelPtBR(series.from)} a ${monthLabelPtBR(series.to)}`;
  const current = data.find((p) => p.month === selectedMonth) ?? data[data.length - 1];

  // modo estreito (D15): abre rolado no fim (mes selecionado)
  useEffect(() => {
    if (view === "chart" && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [view]);

  const description = current
    ? `Evolução mensal de ${subtitle}. Em ${monthLongPtBR(current.month)}: receitas ${formatBRL(current.totals.income)}, despesas ${formatBRL(current.totals.expenses.total)}, saldo realizado ${formatBRL(current.totals.balance.realized)}, saldo previsto ${formatBRL(current.totals.balance.projected)}.`
    : "Sem dados.";

  return (
    <ChartCard title="Evolução mensal" subtitle={subtitle} view={view} onViewChange={setView} description={description}>
      {view === "table" ? (
        <MonthlyTable data={data} />
      ) : (
        <>
          <Legend />
          <div className="relative">
            <div ref={scrollRef} tabIndex={0} role="group" aria-label="Gráfico de evolução mensal" className="overflow-x-auto">
              <div style={{ minWidth: MONTH_WIDTH * 12 + AXIS_WIDTH }} className="h-[260px] md:h-[280px] lg:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={2} accessibilityLayer>
                    <defs>
                      <pattern id="pending-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                        <rect width="6" height="6" style={{ fill: "var(--chart-pending)" }} />
                        <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2" style={{ stroke: "var(--surface)" }} />
                      </pattern>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={(props) => <MonthTick {...props} selected={selectedLabel} />} interval={0} />
                    <YAxis width={AXIS_WIDTH} tickLine={false} axisLine={false} tickFormatter={formatAxisTick} tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
                    <ReferenceLine y={0} stroke="var(--chart-zero-line)" strokeWidth={1.5} />
                    <Tooltip content={<MonthlyTooltip />} cursor={{ fill: "var(--chart-cursor)" }} isAnimationActive={false} />
                    <Bar dataKey="incomeValue" name="Receitas" fill="var(--chart-income)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="paidValue" name="Despesas pagas" stackId="expenses" fill="var(--chart-paid)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
                    <Bar dataKey="pendingValue" name="Despesas pendentes" stackId="expenses" fill="url(#pending-hatch)" stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Line dataKey="realizedValue" name="Saldo realizado" stroke="var(--chart-balance-realized)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-balance-realized)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    <Line dataKey="projectedValue" name="Saldo previsto" stroke="var(--chart-balance-projected)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4, fill: "var(--surface)", stroke: "var(--chart-balance-projected)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            {empty ? (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full border border-border-strong bg-surface px-4 py-1.5 text-sm text-muted">
                Sem lançamentos de {subtitle}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-muted lg:hidden">Deslize para ver os 12 meses</p>
        </>
      )}
    </ChartCard>
  );
}
