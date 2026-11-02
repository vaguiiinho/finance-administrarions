import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { classifyApiError } from '@/core/api-errors';
import { formatBRL, sumDecimals } from '@/lib/money/decimal';
import { currentYearMonthSP, monthLongPtBR } from '@/lib/dates/format';
import type { EntryDto, InvoiceDto } from '@/lib/api/types';
import { useAccountEmpty, useExpenses, useIncomes, useInitialMonth, useInvoices } from '@/data/hooks';
import { showNewEntryMenu } from '@/features/entries/new-entry-menu';
import { useEntryActions } from '@/features/entries/use-entry-actions';
import { ExpenseRow, IncomeRow, InvoiceRow, MonthSwitcher, SubtotalCard } from '@/features/finances/components';
import { useMe, useSession } from '@/features/session/session-provider';
import { useViewState, type FinanceTab, type StatusFilter } from '@/features/view-state/view-state';
import { Button, InlineAlert, Segmented } from '@/ui/controls';
import { BlockError, Loading, ScreenState, Skeleton } from '@/ui/states';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';

const TAB_OPTIONS = [
  { value: 'expenses' as const, label: 'Despesas' },
  { value: 'incomes' as const, label: 'Receitas' },
  { value: 'invoices' as const, label: 'Faturas' },
];
const STATUS_OPTIONS = [
  { value: 'ALL' as const, label: 'Todos' },
  { value: 'PENDING' as const, label: 'Pendente' },
  { value: 'PAID' as const, label: 'Pago' },
];

const isTab = (v: unknown): v is FinanceTab => v === 'expenses' || v === 'incomes' || v === 'invoices';
const isStatus = (v: unknown): v is StatusFilter => v === 'ALL' || v === 'PENDING' || v === 'PAID';

function advanceText(kind: 'NEXT_PENDING' | 'NO_PENDING_AHEAD', from: string, to: string): string {
  return kind === 'NEXT_PENDING'
    ? `Sem pendências em ${monthLongPtBR(from)}. Mostrando ${monthLongPtBR(to)}, o próximo mês com pendências.`
    : `Sem pendências de ${monthLongPtBR(from)} em diante. Mostrando ${monthLongPtBR(to)}.`;
}

function FirstRunState({ tab, router }: { tab: FinanceTab; router: ReturnType<typeof useRouter> }) {
  if (tab === 'incomes')
    return (
      <ScreenState icon="↙" title="Nenhuma receita ainda" message="Registre sua primeira receita para ver quanto entrou no mês.">
        <Button title="Nova receita" onPress={() => router.push('/new/income' as never)} />
      </ScreenState>
    );
  if (tab === 'invoices')
    return (
      <ScreenState
        icon="▭"
        title="Nenhuma fatura ainda"
        message="As faturas aparecem quando você registra uma despesa no cartão. Os cartões são cadastrados no site."
      >
        <Button title="Nova despesa" onPress={() => router.push('/new/expense' as never)} />
      </ScreenState>
    );
  return (
    <ScreenState icon="↗" title="Nenhuma despesa ainda" message="Registre sua primeira despesa para acompanhar o que já pagou e o que falta pagar.">
      <Button title="Nova despesa" onPress={() => router.push('/new/expense' as never)} />
      <Button title="Nova despesa parcelada" kind="tertiary" onPress={() => router.push('/new/installments' as never)} />
    </ScreenState>
  );
}

export default function FinancesScreen() {
  const me = useMe();
  const router = useRouter();
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ tab?: string; status?: string }>();
  const { finances: storedFinances, patchFinances, setFinancesMonth } = useViewState();
  const { pendingDeleteIds } = useSession();
  const actions = useEntryActions();
  const accountEmpty = useAccountEmpty();

  // Parametros de URL (abertura direta / atalhos) valem ate a pessoa mexer na aba/status; a chave evita reaplicar.
  const urlKey = `${params.tab ?? ''}|${params.status ?? ''}`;
  const urlPending = (isTab(params.tab) || isStatus(params.status)) && storedFinances.urlKey !== urlKey;
  const finances = useMemo(
    () => ({
      ...storedFinances,
      tab: urlPending && isTab(params.tab) ? params.tab : storedFinances.tab,
      status: urlPending && isStatus(params.status) ? params.status : storedFinances.status,
    }),
    [storedFinances, urlPending, params.tab, params.status],
  );

  const initial = useInitialMonth(finances.month === null);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [batchAlert, setBatchAlert] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  useEffect(() => {
    if (!urlPending) return;
    const patch: Parameters<typeof patchFinances>[0] = { urlKey };
    if (isTab(params.tab)) patch.tab = params.tab;
    if (isStatus(params.status)) patch.status = params.status;
    patchFinances(patch);
  }, [urlPending, urlKey, params.tab, params.status, patchFinances]);

  // Mes inicial (5.5): decisao da API; falha ou demora => mes corrente, sem aviso (CA16).
  useEffect(() => {
    if (finances.month !== null) return;
    if (initial.data) {
      const { month, currentMonth, advance } = initial.data;
      patchFinances({ month, advance: advance === 'NONE' ? null : { kind: advance, from: currentMonth, to: month } });
    } else if (initial.isError) {
      patchFinances({ month: currentYearMonthSP(), advance: null });
    }
  }, [finances.month, initial.data, initial.isError, patchFinances]);

  const month = finances.month;
  const hideNotice = accountEmpty === true;
  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
    setBatchAlert(null);
  }, []);

  const expenseFilters = useMemo(() => {
    const f: { status?: 'PENDING' | 'PAID'; category?: string; cardId?: string } = {};
    if (finances.status !== 'ALL') f.status = finances.status;
    if (finances.category) f.category = finances.category;
    if (finances.cardId) f.cardId = finances.cardId;
    return f;
  }, [finances.status, finances.category, finances.cardId]);
  const incomeFilters = useMemo(() => (finances.category ? { category: finances.category } : {}), [finances.category]);

  const expenses = useExpenses(month, expenseFilters, finances.tab === 'expenses');
  const incomes = useIncomes(month, incomeFilters, finances.tab === 'incomes');
  const invoices = useInvoices(month, finances.invoiceStatus, finances.tab === 'invoices');

  const hiddenIds = useMemo(() => new Set(pendingDeleteIds), [pendingDeleteIds]);
  const expenseItems = useMemo(() => (expenses.data?.pages.flatMap((p) => p.items) ?? []).filter((e) => !hiddenIds.has(e.id)), [expenses.data, hiddenIds]);
  const incomeItems = useMemo(() => incomes.data?.pages.flatMap((p) => p.items) ?? [], [incomes.data]);
  const pendingItems = useMemo(() => expenseItems.filter((e) => e.status === 'PENDING'), [expenseItems]);

  const changeMonth = (next: string) => {
    exitSelection();
    setFinancesMonth(next);
  };
  const changeTab = (tab: FinanceTab) => {
    exitSelection();
    patchFinances({ tab });
  };

  const toggle = (entry: EntryDto) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  const selectedItems = pendingItems.filter((e) => selected.has(e.id));
  const allSelected = pendingItems.length > 0 && selectedItems.length === pendingItems.length;

  const paySelected = async () => {
    if (batchBusy) return;
    setBatchBusy(true);
    setBatchAlert(null);
    const outcome = await actions.payBatch(selectedItems);
    setBatchBusy(false);
    if (outcome.status === 'paid') exitSelection();
    else if (outcome.status === 'blocked') setBatchAlert(outcome.message);
  };

  const openEdit = (entry: EntryDto) => router.push({ pathname: '/edit/[id]', params: { id: entry.id } } as never);
  const openInvoice = (invoice: InvoiceDto) =>
    router.push({
      pathname: '/finances/invoice/[cardId]/[referenceMonth]',
      params: { cardId: invoice.card.id, referenceMonth: invoice.referenceMonth },
    } as never);

  // ---- cabecalho (rola junto com a lista) ----
  const filterCount = (finances.category ? 1 : 0) + (finances.cardId ? 1 : 0);
  const header: ReactNode = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg }}>
        {selecting ? (
          <Button
            title={allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
            kind="tertiary"
            fullWidth={false}
            accessibilityHint="Seleciona todas as despesas pendentes desta página"
            onPress={() => setSelected(allSelected ? new Set() : new Set(pendingItems.map((e) => e.id)))}
          />
        ) : finances.tab === 'expenses' && pendingItems.length > 0 && !hideNotice ? (
          <Button title="Selecionar" kind="tertiary" fullWidth={false} onPress={() => setSelecting(true)} />
        ) : (
          <View />
        )}
        {selecting ? (
          <Button title="OK" kind="tertiary" fullWidth={false} onPress={exitSelection} />
        ) : (
          <Button
            title="Novo"
            accessibilityLabel="Novo lançamento"
            accessibilityHint="Escolha despesa, despesa parcelada ou receita."
            kind="tertiary"
            fullWidth={false}
            onPress={() => showNewEntryMenu(router)}
          />
        )}
      </View>
      <View style={{ paddingHorizontal: space.lg }}>
        <MonthSwitcher month={month} target="finances" onChange={changeMonth} disabled={selecting} />
      </View>
      {finances.advance && !hideNotice ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <InlineAlert tone="info" closeLabel="Fechar aviso de mês" onClose={() => patchFinances({ advance: null })}>
            {advanceText(finances.advance.kind, finances.advance.from, finances.advance.to)}
          </InlineAlert>
        </View>
      ) : null}
      {batchAlert ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <InlineAlert onClose={() => setBatchAlert(null)} closeLabel="Fechar">
            {batchAlert}
          </InlineAlert>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: space.lg }}>
        <Segmented<FinanceTab> options={TAB_OPTIONS} value={finances.tab} onChange={changeTab} disabled={selecting} />
      </View>
      {hideNotice ? null : finances.tab === 'expenses' ? (
        <>
          <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
            <Segmented<StatusFilter>
              options={STATUS_OPTIONS}
              value={finances.status}
              onChange={(status) => {
                exitSelection();
                patchFinances({ status });
              }}
              disabled={selecting}
            />
            <Button
              title={filterCount > 0 ? `Filtros (${filterCount})` : 'Filtros'}
              accessibilityLabel={filterCount > 0 ? `Filtros, ${filterCount} ativos` : 'Filtros'}
              kind="secondary"
              fullWidth={false}
              onPress={() => router.push('/filters' as never)}
              disabled={selecting}
            />
          </View>
          {expenses.data ? (
            <SubtotalCard
              title={filterCount > 0 || finances.status !== 'ALL' ? 'Subtotal · com os filtros aplicados' : 'Subtotal · todas as despesas do mês'}
              count={expenses.data.pages[0]?.pagination.totalItems ?? 0}
              totals={expenses.data.pages[0]?.subtotal ?? { total: '0.00', paid: '0.00', pending: '0.00' }}
              refreshing={pendingDeleteIds.length > 0}
            />
          ) : null}
        </>
      ) : finances.tab === 'incomes' ? (
        incomes.data ? (
          <SubtotalCard
            title={finances.category ? 'Subtotal · com o filtro aplicado' : 'Subtotal · todas as receitas do mês'}
            count={incomes.data.pages[0]?.pagination.totalItems ?? 0}
            noun={['receita', 'receitas']}
            totals={{ total: incomes.data.pages[0]?.subtotal.total ?? '0.00' }}
          />
        ) : null
      ) : (
        <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
          <Segmented<StatusFilter> options={STATUS_OPTIONS} value={finances.invoiceStatus} onChange={(invoiceStatus) => patchFinances({ invoiceStatus })} />
          {invoices.data ? (
            <Text variant="footnote" tone="muted">
              {`Mostrando ${invoices.data.length} ${invoices.data.length === 1 ? 'fatura' : 'faturas'} de ${month ? monthLongPtBR(month) : ''}`}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  const monthText = month ? monthLongPtBR(month) : '';
  const skeleton = (
    <View style={{ gap: space.sm, paddingHorizontal: space.lg }}>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </View>
  );

  const failed = (what: string, refetch: () => void) => (
    <View style={{ paddingHorizontal: space.lg }}>
      <BlockError message={`Não foi possível carregar ${what}.`} onRetry={refetch} />
    </View>
  );

  const emptyText = (what: string, filtered: boolean) => (
    <View style={{ paddingHorizontal: space.lg, alignItems: 'center', gap: space.sm }}>
      <Text tone="muted" center>
        {filtered ? `Nenhuma ${what} com os filtros aplicados.` : `Nenhuma ${what} em ${monthText}.`}
      </Text>
      {filtered ? (
        <Button title="Limpar filtros" kind="secondary" fullWidth={false} onPress={() => patchFinances({ category: null, cardId: null, status: 'ALL' })} />
      ) : null}
    </View>
  );

  const footer = (query: { isFetchingNextPage: boolean; isFetchNextPageError: boolean; fetchNextPage: () => unknown }) =>
    query.isFetchNextPageError ? (
      <View style={{ padding: space.lg }}>
        <BlockError message="Não foi possível carregar mais itens." onRetry={() => void query.fetchNextPage()} />
      </View>
    ) : query.isFetchingNextPage ? (
      <Loading label="Carregando mais…" />
    ) : null;

  const listPadding = { paddingBottom: selecting ? 160 : space.xl };
  const container = { flex: 1, backgroundColor: palette.bg };

  if (hideNotice) {
    return (
      <View style={container}>
        <FlashList
          data={[] as EntryDto[]}
          renderItem={() => null}
          ListHeaderComponent={<>{header}</>}
          ListEmptyComponent={<FirstRunState tab={finances.tab} router={router} />}
        />
      </View>
    );
  }

  if (finances.tab === 'incomes') {
    return (
      <View style={container}>
        <FlashList
          data={incomeItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <IncomeRow entry={item} />}
          ListHeaderComponent={<>{header}</>}
          ListEmptyComponent={
            month === null || incomes.isPending
              ? skeleton
              : incomes.isError
                ? failed('as receitas', () => void incomes.refetch())
                : emptyText('receita', !!finances.category)
          }
          ListFooterComponent={footer(incomes)}
          onEndReached={() => incomes.hasNextPage && !incomes.isFetchingNextPage && void incomes.fetchNextPage()}
          onEndReachedThreshold={1.5}
          refreshing={incomes.isRefetching}
          onRefresh={() => void incomes.refetch()}
          contentContainerStyle={listPadding}
        />
      </View>
    );
  }

  if (finances.tab === 'invoices') {
    return (
      <View style={container}>
        <FlashList
          data={invoices.data ?? []}
          keyExtractor={(item) => `${item.card.id}:${item.referenceMonth}`}
          renderItem={({ item }) => (
            <InvoiceRow
              invoice={item}
              busy={actions.busyIds.has(`invoice:${item.card.id}:${item.referenceMonth}`)}
              onOpen={openInvoice}
              onPay={(invoice) => void actions.payInvoice(invoice)}
            />
          )}
          ListHeaderComponent={<>{header}</>}
          ListEmptyComponent={
            month === null || invoices.isPending
              ? skeleton
              : invoices.isError
                ? failed('as faturas', () => void invoices.refetch())
                : emptyText('fatura', false)
          }
          refreshing={invoices.isRefetching}
          onRefresh={() => void invoices.refetch()}
          contentContainerStyle={listPadding}
        />
      </View>
    );
  }

  const errorKind = expenses.error ? classifyApiError(expenses.error as never).kind : null;
  return (
    <View style={container}>
      <FlashList
        data={expenseItems}
        extraData={{ selecting, selected, busy: actions.busyIds }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseRow
            entry={item}
            capabilities={me.capabilities}
            busy={actions.busyIds.has(item.id)}
            selecting={selecting}
            selected={selected.has(item.id)}
            onPay={(entry) => void actions.payOne(entry)}
            onEdit={openEdit}
            onDelete={(entry) => void actions.removeExpense(entry)}
            onToggleSelect={toggle}
          />
        )}
        ListHeaderComponent={<>{header}</>}
        ListEmptyComponent={
          month === null || expenses.isPending
            ? skeleton
            : expenses.isError && errorKind !== null
              ? failed('as despesas', () => void expenses.refetch())
              : emptyText('despesa', !!finances.category || !!finances.cardId)
        }
        ListFooterComponent={footer(expenses)}
        onEndReached={() => expenses.hasNextPage && !expenses.isFetchingNextPage && void expenses.fetchNextPage()}
        onEndReachedThreshold={1.5}
        refreshing={!selecting && expenses.isRefetching}
        onRefresh={selecting ? undefined : () => void expenses.refetch()}
        contentContainerStyle={listPadding}
      />
      {selecting ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            borderTopWidth: 1,
            padding: space.lg,
            gap: space.sm,
          }}
        >
          <Text variant="subheadline" accessibilityLiveRegion="polite">
            {`${selectedItems.length} ${selectedItems.length === 1 ? 'selecionada' : 'selecionadas'} · ${selectedItems.length ? formatTotal(selectedItems) : 'R$ 0,00'}`}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Limpar" kind="secondary" fullWidth={false} onPress={() => setSelected(new Set())} />
            <View style={{ flex: 1 }}>
              <Button
                title={`Marcar como pago (${selectedItems.length})`}
                disabled={selectedItems.length === 0}
                busy={batchBusy}
                busyTitle="Pagando…"
                onPress={() => void paySelected()}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatTotal(items: readonly EntryDto[]): string {
  return formatBRL(sumDecimals(items.map((i) => i.amount)));
}
