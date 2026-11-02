import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { formatAxisTick, formatPercent, groupCategories, isSeriesEmpty, niceScale, toChartPoints } from '@/lib/dashboard/chart-data';
import { monthLongPtBR } from '@/lib/dates/format';
import { formatBRL } from '@/lib/money/decimal';
import type { CategoryDistribution, MonthlySeries } from '@/lib/api/types';
import { Segmented } from '@/ui/controls';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';

/** Legenda com texto (nunca so cor). */
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <View accessible={false} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color }} />
          <Text variant="footnote" tone="muted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Evolucao mensal (6.3): barras de receitas e despesas (pago + pendente), com tabela alternativa. */
export function EvolutionChart({ series }: { series: MonthlySeries }) {
  const { palette } = useTheme();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const points = useMemo(() => toChartPoints(series.points), [series.points]);
  const scale = useMemo(() => niceScale(points), [points]);
  const stackData = useMemo(
    () =>
      points.flatMap((p) => [
        { stacks: [{ value: p.incomeValue, color: palette.chartIncome }], label: p.label, spacing: 2 },
        {
          stacks: [
            { value: p.paidValue, color: palette.chartPaid, marginBottom: 0 },
            { value: p.pendingValue, color: palette.chartPending, marginBottom: 1 },
          ],
          spacing: 16,
        },
      ]),
    [points, palette],
  );
  const summary = `Evolução de ${points[0]?.label ?? ''} a ${points[points.length - 1]?.label ?? ''}. Veja a tabela para os valores.`;

  return (
    <View style={{ gap: space.md }}>
      <Segmented<'chart' | 'table'>
        value={view}
        onChange={setView}
        options={[
          { value: 'chart', label: 'Gráfico' },
          { value: 'table', label: 'Tabela' },
        ]}
      />
      {view === 'chart' ? (
        <>
          <Legend
            items={[
              { color: palette.chartIncome, label: 'Receitas' },
              { color: palette.chartPaid, label: 'Pago' },
              { color: palette.chartPending, label: 'Pendente' },
            ]}
          />
          <Text variant="footnote" tone="muted" accessibilityLabel={summary}>
            Deslize para ver os 12 meses
          </Text>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <BarChart
              stackData={stackData}
              barWidth={14}
              initialSpacing={8}
              noOfSections={scale.ticks.length - 1}
              maxValue={scale.domain[1]}
              mostNegativeValue={scale.domain[0]}
              yAxisLabelTexts={scale.ticks.map((t) => formatAxisTick(t))}
              yAxisTextStyle={{ color: palette.chartAxis, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: palette.chartAxis, fontSize: 11 }}
              rulesColor={palette.chartGrid}
              yAxisColor={palette.chartGrid}
              xAxisColor={palette.chartGrid}
              yAxisLabelWidth={58}
              scrollToEnd
              disableScroll={false}
              isAnimated={false}
              height={180}
            />
          </View>
        </>
      ) : (
        <View style={{ gap: space.sm }}>
          {[...points].reverse().map((p) => (
            <View key={p.month} accessible style={{ gap: 2 }}>
              <Text variant="headline">{monthLongPtBR(p.month)}</Text>
              <Text variant="subheadline" tabular>{`Receitas ${formatBRL(p.totals.income)}`}</Text>
              <Text variant="subheadline" tabular>{`Despesas ${formatBRL(p.totals.expenses.total)}`}</Text>
              <Text variant="subheadline" tabular>{`Saldo no mês ${formatBRL(p.totals.balance.projected)}`}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const seriesIsEmpty = (series: MonthlySeries) => series.points.length === 0 || isSeriesEmpty(series.points);

/** Rosca de despesas por categoria; a legenda e a tabela (6.3). */
export function CategoryDonut({ distribution }: { distribution: CategoryDistribution }) {
  const { palette } = useTheme();
  const slices = useMemo(() => groupCategories(distribution.items), [distribution.items]);
  const data = slices.map((s, i) => ({ value: Number(s.total), color: palette.chart[Math.min(i, palette.chart.length - 1)] }));
  return (
    <View style={{ gap: space.md }}>
      <View style={{ alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PieChart
          donut
          radius={84}
          innerRadius={54}
          data={data}
          innerCircleColor={palette.surface}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text variant="headline" tabular>
                {formatBRL(distribution.total)}
              </Text>
              <Text variant="footnote" tone="muted">
                Total
              </Text>
            </View>
          )}
        />
      </View>
      <View style={{ gap: space.sm }}>
        {slices.map((s, i) => (
          <View key={s.key} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View
                accessible={false}
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.chart[Math.min(i, palette.chart.length - 1)] }}
              />
              <Text style={{ flex: 1 }}>{s.category}</Text>
              <Text tabular>{formatBRL(s.total)}</Text>
              <Text tone="muted" tabular>
                {formatPercent(s.percentage)}
              </Text>
            </View>
            {s.members ? (
              <Text variant="footnote" tone="muted" numberOfLines={2}>
                {s.members.join(', ')}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
