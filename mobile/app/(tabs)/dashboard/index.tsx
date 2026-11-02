import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isAccountEmpty } from '@/core/account-empty';
import { isDemoAccount } from '@/core/account-kind';
import { DEMO_CLEANUP_TEXT } from '@/core/messages';
import { monthLongPtBR } from '@/lib/dates/format';
import { formatBRL, toCents } from '@/lib/money/decimal';
import type { TotalsDto } from '@/lib/api/types';
import { useCategories, useCategoryDistribution, useSeries, useSummary } from '@/data/hooks';
import { CategoryDonut, EvolutionChart, seriesIsEmpty } from '@/features/dashboard/charts';
import { showNewEntryMenu } from '@/features/entries/new-entry-menu';
import { AmountPair, MonthSwitcher, SignIndicator } from '@/features/finances/components';
import { useMe } from '@/features/session/session-provider';
import { useViewState } from '@/features/view-state/view-state';
import { Button, Card, Screen } from '@/ui/controls';
import { BlockError, Skeleton } from '@/ui/states';
import { Text } from '@/ui/Text';
import { space } from '@/ui/tokens';

const ZERO_TOTALS: TotalsDto = { income: '0.00', expenses: { total: '0.00', paid: '0.00', pending: '0.00' }, balance: { realized: '0.00', projected: '0.00' } };

function SummaryCards({ totals }: { totals: TotalsDto }) {
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <AmountPair label="Receitas" value={totals.income} strong />
      </Card>
      <Card>
        <AmountPair label="Despesas" value={totals.expenses.total} strong />
        <AmountPair label="Pago" value={totals.expenses.paid} dot="success" />
        <AmountPair label="Pendente" value={totals.expenses.pending} dot="warning" />
      </Card>
      <Card>
        <Text variant="subheadline" tone="muted">
          Saldo realizado
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title2" tabular>
            {formatBRL(totals.balance.realized)}
          </Text>
          <SignIndicator value={totals.balance.realized} />
        </View>
        <Text variant="footnote" tone="muted">
          receitas − despesas pagas
        </Text>
        <Text variant="subheadline" tone="muted" style={{ marginTop: space.sm }}>
          Saldo previsto
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title2" tabular>
            {formatBRL(totals.balance.projected)}
          </Text>
          <SignIndicator value={totals.balance.projected} />
        </View>
        <Text variant="footnote" tone="muted">
          receitas − todas as despesas
        </Text>
      </Card>
    </View>
  );
}

function CompactSummary({ totals }: { totals: TotalsDto }) {
  return (
    <Card>
      <AmountPair label="Receitas" value={totals.income} />
      <AmountPair label="Despesas" value={totals.expenses.total} />
      <AmountPair label="Saldo realizado" value={totals.balance.realized} />
      <AmountPair label="Saldo previsto" value={totals.balance.projected} />
    </Card>
  );
}

export default function Dashboard() {
  const me = useMe();
  const router = useRouter();
  const { dashboardMonth, setDashboardMonth } = useViewState();
  const month = dashboardMonth;
  const categories = useCategories();
  const summary = useSummary(month);
  const series = useSeries(month);
  const distribution = useCategoryDistribution(month);
  const accountEmpty = isAccountEmpty(categories.data);
  const monthText = monthLongPtBR(month);

  const refresh = () => {
    void summary.refetch();
    void series.refetch();
    void distribution.refetch();
    void categories.refetch();
  };
  const refreshing = summary.isRefetching || series.isRefetching || distribution.isRefetching;

  const header = (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button
          title="Novo"
          accessibilityLabel="Novo lançamento"
          accessibilityHint="Escolha despesa, despesa parcelada ou receita."
          kind="tertiary"
          fullWidth={false}
          onPress={() => showNewEntryMenu(router)}
        />
      </View>
      <MonthSwitcher month={month} target="dashboard" onChange={setDashboardMonth} />
    </View>
  );

  // Enquanto o sinal de conta vazia nao chega, skeletons (sem piscar o card de boas-vindas).
  if (categories.isPending) {
    return (
      <Screen>
        {header}
        <Skeleton height={120} />
        <Skeleton height={160} />
        <Skeleton height={200} />
      </Screen>
    );
  }

  if (accountEmpty === true) {
    return (
      <Screen>
        {header}
        <Card accent testID="welcome-card">
          <Text variant="title3" center accessibilityRole="header">
            Comece pelo primeiro lançamento
          </Text>
          <Text tone="muted" center>
            Registre uma despesa ou receita para ver o resumo do mês, a evolução e os gastos por categoria.
          </Text>
          <Button title="Nova despesa" onPress={() => router.push('/new/expense' as never)} />
          <Button title="Nova receita" kind="secondary" onPress={() => router.push('/new/income' as never)} />
          {isDemoAccount(me) ? (
            <Text variant="footnote" tone="muted">
              {DEMO_CLEANUP_TEXT}
            </Text>
          ) : null}
        </Card>
        <Text variant="subheadline" tone="muted">{`Resumo de ${monthText}`}</Text>
        <CompactSummary totals={summary.data ?? ZERO_TOTALS} />
        <Card>
          <Text variant="subheadline">O que aparece aqui</Text>
          <Text variant="subheadline">Evolução mensal</Text>
          <Text variant="footnote" tone="muted">
            Receitas e despesas dos últimos 12 meses.
          </Text>
          <Text variant="subheadline">Despesas por categoria</Text>
          <Text variant="footnote" tone="muted">
            Onde o dinheiro foi no mês.
          </Text>
        </Card>
      </Screen>
    );
  }

  const noEntriesThisMonth = summary.data ? toCents(summary.data.income) === 0n && toCents(summary.data.expenses.total) === 0n : false;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {header}
      <Text variant="subheadline" tone="muted">{`Resumo de ${monthText}`}</Text>
      {summary.isPending ? (
        <Skeleton height={220} />
      ) : summary.isError ? (
        <BlockError message="Não foi possível carregar o resumo." onRetry={() => void summary.refetch()} />
      ) : (
        <>
          <SummaryCards totals={summary.data} />
          {noEntriesThisMonth ? (
            <Text tone="muted" center>
              Sem lançamentos neste mês
            </Text>
          ) : null}
        </>
      )}

      <Card>
        <Text variant="headline">Evolução mensal</Text>
        {series.isPending ? (
          <Skeleton height={180} />
        ) : series.isError ? (
          <BlockError message="Não foi possível carregar a evolução mensal." onRetry={() => void series.refetch()} />
        ) : seriesIsEmpty(series.data) ? (
          <Text tone="muted" center>
            {series.data.from && series.data.to ? `Sem lançamentos de ${series.data.from} – ${series.data.to}` : 'Sem lançamentos nos últimos 12 meses'}
          </Text>
        ) : (
          <EvolutionChart series={series.data} />
        )}
      </Card>

      <Card>
        <Text variant="headline">Despesas por categoria</Text>
        <Text variant="footnote" tone="muted">
          {monthText}
        </Text>
        {distribution.isPending ? (
          <Skeleton height={200} />
        ) : distribution.isError ? (
          <BlockError message="Não foi possível carregar as despesas por categoria." onRetry={() => void distribution.refetch()} />
        ) : distribution.data.items.length === 0 ? (
          <View style={{ gap: space.sm, alignItems: 'center' }}>
            <Text variant="title2" tabular>
              {formatBRL('0.00')}
            </Text>
            <Text tone="muted" center>{`Nenhuma despesa em ${monthText}`}</Text>
            <Button title="Ir para Finanças" kind="secondary" fullWidth={false} onPress={() => router.push('/finances' as never)} />
          </View>
        ) : (
          <CategoryDonut distribution={distribution.data} />
        )}
      </Card>
    </Screen>
  );
}
