import { useMemo } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useInvoiceEntries, useInvoices } from '@/data/hooks';
import { useEntryActions } from '@/features/entries/use-entry-actions';
import { AmountPair, ExpenseRow, isInvoicePaid } from '@/features/finances/components';
import { useMe, useSession } from '@/features/session/session-provider';
import { monthLongPtBR, formatCivilDate } from '@/lib/dates/format';
import type { EntryDto } from '@/lib/api/types';
import { Button, Card } from '@/ui/controls';
import { BlockError, Loading } from '@/ui/states';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';

/** Detalhe da fatura (DM8, 5.6): empilhado na pilha da aba Financas, com as acoes das linhas de Despesas. */
export default function InvoiceDetail() {
  const { cardId, referenceMonth } = useLocalSearchParams<{ cardId: string; referenceMonth: string }>();
  const me = useMe();
  const router = useRouter();
  const { palette } = useTheme();
  const { pendingDeleteIds } = useSession();
  const actions = useEntryActions();
  const entries = useInvoiceEntries(cardId, referenceMonth);
  const invoices = useInvoices(referenceMonth, 'ALL');
  const invoice = invoices.data?.find((i) => i.card.id === cardId && i.referenceMonth === referenceMonth) ?? null;
  const hidden = useMemo(() => new Set(pendingDeleteIds), [pendingDeleteIds]);
  const items = useMemo(() => (entries.data ?? []).filter((e) => !hidden.has(e.id)), [entries.data, hidden]);
  const paid = invoice ? isInvoicePaid(invoice) : false;

  const pay = async () => {
    if (!invoice) return;
    const outcome = await actions.payInvoice(invoice);
    if (outcome === 'gone') router.back();
  };

  const header = (
    <View style={{ gap: space.md, padding: space.lg }}>
      <Text variant="subheadline" tone="muted">{`Fatura de ${monthLongPtBR(referenceMonth)}`}</Text>
      {invoice ? (
        <Card>
          <Text variant="subheadline" tabular>{`Fecha ${formatCivilDate(invoice.closingDate)}`}</Text>
          <Text variant="subheadline" tabular>{`Vence ${formatCivilDate(invoice.dueDate)}`}</Text>
          <AmountPair label="Total" value={invoice.totals.total} strong />
          <AmountPair label="Pago" value={invoice.totals.paid} dot="success" />
          <AmountPair label="Pendente" value={invoice.totals.pending} dot="warning" />
          {paid ? (
            <Text variant="subheadline" tone="success">
              ✓ Fatura paga
            </Text>
          ) : null}
          <Button
            title="Pagar fatura"
            accessibilityLabel={`Pagar fatura ${invoice.card.name} de ${monthLongPtBR(referenceMonth)}`}
            disabled={paid}
            busy={actions.busyIds.has(`invoice:${cardId}:${referenceMonth}`)}
            busyTitle="Pagando…"
            onPress={() => void pay()}
          />
        </Card>
      ) : invoices.isPending ? (
        <Loading />
      ) : null}
      <Text variant="headline">{`${items.length} ${items.length === 1 ? 'despesa' : 'despesas'}`}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: invoice?.card.name ?? 'Fatura' }} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseRow
            entry={item}
            capabilities={me.capabilities}
            busy={actions.busyIds.has(item.id)}
            hidePaymentLine
            onPay={(entry: EntryDto) => void actions.payOne(entry)}
            onEdit={(entry: EntryDto) => router.push({ pathname: '/edit/[id]', params: { id: entry.id } } as never)}
            onDelete={(entry: EntryDto) => void actions.removeExpense(entry)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          entries.isPending ? (
            <Loading />
          ) : entries.isError ? (
            <View style={{ padding: space.lg }}>
              <BlockError message="Não foi possível carregar as despesas desta fatura." onRetry={() => void entries.refetch()} />
            </View>
          ) : (
            <Text tone="muted" center>
              Nenhuma despesa nesta fatura.
            </Text>
          )
        }
        refreshing={entries.isRefetching}
        onRefresh={() => {
          void entries.refetch();
          void invoices.refetch();
        }}
      />
    </View>
  );
}
