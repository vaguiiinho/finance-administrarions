"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IconButton } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { SignIndicator } from "@/components/ui/status";
import { monthLabelPtBR, monthLongPtBR } from "@/lib/dates/format";
import { formatBRL } from "@/lib/money/decimal";
import { usePrefersReducedMotion } from "@/lib/hooks/reduced-motion";
import { formatAxisTick, isSeriesEmpty, niceScale, scrollLeftForMonth, toChartPoints, type ChartPoint } from "@/lib/dashboard/chart-data";
import type { MonthlySeries } from "@/lib/api/types";
import { ChartCard, type ChartView } from "./chart-card";
import { MONTHLY_CHART_HEIGHT } from "./chart-layout";

const MONTH_WIDTH = 56; // >= 44px por mes (alvo minimo) no modo estreito
const AXIS_WIDTH = 76;
const NARROW_BELOW = 560; // largura util abaixo da qual o eixo Y fica fixo e as barras rolam (D15)
const MARGIN = { top: 8, right: 8, bottom: 4, left: 0 };
const X_AXIS_HEIGHT = 30; // igual nos dois graficos do modo estreito: o Recharts nao reserva altura para XAxis oculto

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
            <th scope="col" className="sticky left-0 bg-bar px-2 py-2 font-medium">Mês</th>
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
              <th scope="row" className="sticky left-0 bg-bar px-2 py-2 text-left font-medium text-text">{monthLongPtBR(month)}</th>
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

interface PlotProps {
  data: ChartPoint[];
  selectedLabel: string;
  scale: ReturnType<typeof niceScale>;
  animate: boolean;
  /** Mes ativo pelo teclado (tooltip controlado); `null` = tooltip so por ponteiro */
  activeIndex?: number | null;
  /** Eixo Y: visivel, oculto (area rolavel) ou so o eixo (coluna fixa) */
  part: "full" | "axis" | "bars";
}

/** Desenha o grafico inteiro, so o eixo Y (coluna fixa) ou so as barras (area rolavel) com a MESMA escala. */
function Plot({ data, selectedLabel, scale, animate, part, activeIndex = null }: PlotProps) {
  const showBars = part !== "axis";
  const patternId = `hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={part === "axis" ? { ...MARGIN, right: 0 } : MARGIN} barGap={2} accessibilityLayer={false}>
        {showBars ? (
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" style={{ fill: "var(--chart-pending)" }} />
              <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2" style={{ stroke: "var(--chart-sep)" }} />
            </pattern>
          </defs>
        ) : null}
        {showBars ? <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--chart-grid)" /> : null}
        <XAxis
          dataKey="label"
          height={X_AXIS_HEIGHT}
          tickLine={false}
          axisLine={part === "axis" ? false : { stroke: "var(--chart-grid)" }}
          tick={part === "axis" ? false : (props) => <MonthTick {...props} selected={selectedLabel} />}
          interval={0}
        />
        <YAxis
          hide={part === "bars"}
          width={part === "bars" ? 0 : AXIS_WIDTH}
          domain={scale.domain}
          ticks={scale.ticks}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatAxisTick}
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
        />
        {/* F4: faixa fixa do mes selecionado, atras das series (declarada antes das barras) */}
        {showBars ? <ReferenceArea x1={selectedLabel} x2={selectedLabel} fill="var(--chart-cursor)" fillOpacity={1} stroke="none" ifOverflow="visible" /> : null}
        {showBars ? <ReferenceLine y={0} stroke="var(--chart-zero-line)" strokeWidth={1.5} /> : null}
        {showBars ? (
          <Tooltip
            content={<MonthlyTooltip />}
            cursor={{ fill: "var(--chart-cursor)", stroke: "none" }}
            isAnimationActive={false}
            active={activeIndex !== null ? true : undefined}
            defaultIndex={activeIndex ?? undefined}
          />
        ) : null}
        <Bar dataKey="incomeValue" name="Receitas" fill="var(--chart-income)" radius={[4, 4, 0, 0]} isAnimationActive={animate} animationDuration={250} />
        <Bar dataKey="paidValue" name="Despesas pagas" stackId="expenses" fill="var(--chart-paid)" stroke="var(--chart-sep)" strokeWidth={2} isAnimationActive={animate} animationDuration={250} />
        <Bar dataKey="pendingValue" name="Despesas pendentes" stackId="expenses" fill={`url(#${patternId})`} stroke="var(--chart-sep)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={animate} animationDuration={250} />
        <Line dataKey="realizedValue" name="Saldo realizado" stroke="var(--chart-balance-realized)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-balance-realized)", stroke: "var(--chart-sep)", strokeWidth: 2 }} activeDot={{ r: 5, fill: "var(--chart-balance-realized)", stroke: "var(--chart-sep)", strokeWidth: 2 }} isAnimationActive={animate} animationDuration={250} />
        <Line dataKey="projectedValue" name="Saldo previsto" stroke="var(--chart-balance-projected)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4, fill: "var(--chart-sep)", stroke: "var(--chart-balance-projected)", strokeWidth: 2 }} activeDot={{ r: 5, fill: "var(--chart-sep)", stroke: "var(--chart-balance-projected)", strokeWidth: 2 }} isAnimationActive={animate} animationDuration={250} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Evolucao mensal (RF16, D3, D15): barras empilhadas + saldos; em contêiner estreito o eixo Y fica fixo e so as barras rolam. */
export function MonthlyChart({ series, selectedMonth }: { series: MonthlySeries; selectedMonth: string }) {
  const [view, setView] = useState<ChartView>("chart");
  const [narrow, setNarrow] = useState(false);
  const data = useMemo(() => toChartPoints(series.points), [series.points]);
  const scale = useMemo(() => niceScale(data), [data]);
  const reduced = usePrefersReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const empty = isSeriesEmpty(series.points);
  const selectedLabel = monthLabelPtBR(selectedMonth);
  const subtitle = `${monthLabelPtBR(series.from)} a ${monthLabelPtBR(series.to)}`;
  const current = data.find((p) => p.month === selectedMonth) ?? data[data.length - 1];
  const foundIndex = data.findIndex((p) => p.month === selectedMonth);
  const selectedIndex = foundIndex >= 0 ? foundIndex : Math.max(0, data.length - 1); // fora da serie: ultimo mes (coerente com o resumo)
  const contentWidth = MONTH_WIDTH * data.length;

  // largura util do contêiner decide o modo (abaixo de 560px: eixo fixo + rolagem)
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setNarrow(host.clientWidth > 0 && host.clientWidth < NARROW_BELOW);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [view]);

  const [edges, setEdges] = useState({ start: true, end: false });
  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (el) setEdges({ start: el.scrollLeft <= 0, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);

  // abre rolado no mes selecionado
  useEffect(() => {
    const el = scrollRef.current;
    if (narrow && el) {
      el.scrollLeft = scrollLeftForMonth(selectedIndex, MONTH_WIDTH, el.clientWidth, contentWidth);
      updateEdges();
    }
  }, [narrow, view, selectedIndex, contentWidth, updateEdges]);

  // Teclado (F5): UMA parada de Tab por grafico (o contêiner). Setas/Home/End movem o mes ativo, que mostra o tooltip e,
  // no modo estreito, rola a area para mante-lo visivel. Esc dispensa o tooltip (WCAG 1.4.13). Comeca no mes selecionado.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastIndex = data.length - 1;
  const onChartFocus = (event: FocusEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    let keyboard = true;
    try {
      keyboard = event.currentTarget.matches(":focus-visible");
    } catch {
      // seletor nao suportado: trata como teclado
    }
    if (keyboard && lastIndex >= 0) setActiveIndex(selectedIndex);
  };
  const onChartKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || lastIndex < 0) return;
    const from = activeIndex ?? selectedIndex;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = Math.min(from + 1, lastIndex);
        break;
      case "ArrowLeft":
        next = Math.max(from - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = lastIndex;
        break;
      case "Escape":
        if (activeIndex !== null) {
          event.preventDefault();
          setActiveIndex(null);
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    setActiveIndex(next);
  };
  const keyboardProps = { tabIndex: 0, onFocus: onChartFocus, onBlur: () => setActiveIndex(null), onKeyDown: onChartKeyDown } as const;

  useEffect(() => {
    const el = scrollRef.current;
    if (activeIndex === null || !narrow || !el) return;
    const left = activeIndex * MONTH_WIDTH;
    if (left < el.scrollLeft || left + MONTH_WIDTH > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = scrollLeftForMonth(activeIndex, MONTH_WIDTH, el.clientWidth, contentWidth); // alvo = ponto de snap (centralizado)
      updateEdges();
    }
  }, [activeIndex, narrow, contentWidth, updateEdges]);
  const activePoint = activeIndex !== null ? data[activeIndex] : undefined;

  const scrollByMonths = useCallback((months: number) => scrollRef.current?.scrollBy({ left: months * MONTH_WIDTH, behavior: reduced ? "auto" : "smooth" }), [reduced]);

  const description = current
    ? `Evolução mensal de ${subtitle}. Em ${monthLongPtBR(current.month)}: receitas ${formatBRL(current.totals.income)}, despesas ${formatBRL(current.totals.expenses.total)}, saldo realizado ${formatBRL(current.totals.balance.realized)}, saldo previsto ${formatBRL(current.totals.balance.projected)}.`
    : "Sem dados.";
  const height = MONTHLY_CHART_HEIGHT;

  return (
    <ChartCard title="Evolução mensal" subtitle={subtitle} view={view} onViewChange={setView} description={description}>
      {view === "table" ? (
        <MonthlyTable data={data} />
      ) : (
        <>
          <Legend />
          <div ref={hostRef} className="relative" data-narrow={narrow}>
            {narrow ? (
              <div className={`flex ${height}`}>
                <div style={{ width: AXIS_WIDTH }} className="shrink-0" aria-hidden="true" data-testid="fixed-axis">
                  <Plot data={data} selectedLabel={selectedLabel} scale={scale} animate={false} part="axis" />
                </div>
                <div
                  ref={scrollRef}
                  {...keyboardProps}
                  role="group"
                  aria-label="Gráfico de evolução mensal, role para ver os 12 meses"
                  className="min-w-0 flex-1 overflow-x-auto"
                  style={{ scrollSnapType: "x proximity" }}
                  onScroll={updateEdges}
                  data-testid="scroll-area"
                >
                  <div style={{ width: contentWidth }} className="relative h-full">
                    {/* F3: um alvo de snap por mes, centralizado (mesmo alinhamento da abertura no mes selecionado) */}
                    {data.map((point, index) => (
                      <span key={point.month} aria-hidden="true" className="pointer-events-none absolute top-0 h-px" style={{ left: index * MONTH_WIDTH, width: MONTH_WIDTH, scrollSnapAlign: "center" }} />
                    ))}
                    <Plot data={data} selectedLabel={selectedLabel} scale={scale} animate={!reduced} part="bars" activeIndex={activeIndex} />
                  </div>
                </div>
              </div>
            ) : (
              <div className={height} role="group" aria-label="Gráfico de evolução mensal" {...keyboardProps}>
                <Plot data={data} selectedLabel={selectedLabel} scale={scale} animate={!reduced} part="full" activeIndex={activeIndex} />
              </div>
            )}
            <p className="sr-only" aria-live="polite">
              {activePoint
                ? `${monthLongPtBR(activePoint.month)}: receitas ${formatBRL(activePoint.totals.income)}, despesas ${formatBRL(activePoint.totals.expenses.total)}, saldo realizado ${formatBRL(activePoint.totals.balance.realized)}, saldo previsto ${formatBRL(activePoint.totals.balance.projected)}.`
                : ""}
            </p>
            {empty ? (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full border border-border-strong bg-surface px-4 py-1.5 text-sm text-muted">
                Sem lançamentos de {subtitle}
              </p>
            ) : null}
          </div>
          {narrow ? (
            <div className="flex items-center justify-between gap-2">
              <IconButton aria-label="Meses anteriores" disabled={edges.start} onClick={() => scrollByMonths(-3)}>
                <span aria-hidden="true">‹</span>
              </IconButton>
              <p className="text-sm text-muted">Deslize para ver os 12 meses</p>
              <IconButton aria-label="Meses recentes" disabled={edges.end} onClick={() => scrollByMonths(3)}>
                <span aria-hidden="true">›</span>
              </IconButton>
            </div>
          ) : null}
        </>
      )}
    </ChartCard>
  );
}
