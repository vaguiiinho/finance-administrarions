import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { entryActions } from '@/core/entry-actions';
import type { Capability, EntryDto, InvoiceDto } from '@/lib/api/types';
import { formatCivilDate, formatInstantDate, monthLabelPtBR, monthLongPtBR, shiftMonth } from '@/lib/dates/format';
import { formatBRL, signOf, toCents, type Sign } from '@/lib/money/decimal';
import { Button, Card } from '@/ui/controls';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, radius, space } from '@/ui/tokens';

/** `‹ novembro de 2026 ›` (6.8): o rotulo abre a folha com a grade de meses. */
export function MonthSwitcher({
  month,
  target,
  onChange,
  disabled,
}: {
  month: string | null;
  target: 'dashboard' | 'finances';
  onChange: (month: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { palette } = useTheme();
  if (!month) return <View style={{ height: MIN_TOUCH }} accessibilityElementsHidden />;
  const arrow = (label: string, glyph: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(shiftMonth(month, delta))}
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text variant="title2" tone={disabled ? 'disabled' : 'accent'} accessible={false}>
        {glyph}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow('Mês anterior', '‹', -1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={monthLongPtBR(month)}
        accessibilityHint="Toque para escolher outro mês"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => router.push({ pathname: '/month-picker', params: { target, value: month } } as never)}
        style={{ minHeight: MIN_TOUCH, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.surface2 }}
      >
        <Text variant="headline" accessible={false}>
          {monthLongPtBR(month)}
        </Text>
      </Pressable>
      {arrow('Próximo mês', '›', 1)}
    </View>
  );
}

const SIGN_LABEL: Record<Sign, { text: string; glyph: string; tone: 'success' | 'danger' | 'muted' }> = {
  positive: { text: 'Positivo', glyph: '↑', tone: 'success' },
  negative: { text: 'Negativo', glyph: '↓', tone: 'danger' },
  zero: { text: 'Zerado', glyph: '=', tone: 'muted' },
};

/** Sinal do saldo: seta + texto (nunca so cor). */
export function SignIndicator({ value }: { value: string }) {
  const sign = SIGN_LABEL[signOf(value)];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Text variant="footnote" tone={sign.tone} accessible={false}>
        {sign.glyph}
      </Text>
      <Text variant="footnote" tone={sign.tone}>
        {sign.text}
      </Text>
    </View>
  );
}

/** Status com glifo + texto (Pendente, Pago, Recebida). */
export function StatusBadge({ status, busy }: { status: EntryDto['status']; busy?: boolean }) {
  if (busy)
    return (
      <Text variant="footnote" tone="muted">
        Pagando…
      </Text>
    );
  const map = {
    PENDING: { glyph: '◔', text: 'Pendente', tone: 'warning' },
    PAID: { glyph: '✓', text: 'Pago', tone: 'success' },
    RECEIVED: { glyph: '↙', text: 'Recebida', tone: 'income' },
  } as const;
  const { glyph, text, tone } = map[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Text variant="footnote" tone={tone} accessible={false}>
        {glyph}
      </Text>
      <Text variant="subheadline" tone={tone}>
        {text}
      </Text>
    </View>
  );
}

const showInvoiceChip = (e: EntryDto) => e.paymentMethod === 'CARD' && !!e.referenceMonth && e.referenceMonth !== e.date.slice(0, 7);

interface ExpenseRowProps {
  entry: EntryDto;
  capabilities: readonly Capability[];
  busy?: boolean;
  selecting?: boolean;
  selected?: boolean;
  /** No detalhe da fatura a linha da forma de pagamento some. */
  hidePaymentLine?: boolean;
  onPay?: (entry: EntryDto) => void;
  onEdit?: (entry: EntryDto) => void;
  onDelete?: (entry: EntryDto) => void;
  onToggleSelect?: (entry: EntryDto) => void;
}

/** Linha de despesa (`ExpenseRow`, 6.4): circulo de status (DM15), corpo que edita e acoes visiveis. */
export function ExpenseRow({ entry, capabilities, busy, selecting, selected, hidePaymentLine, onPay, onEdit, onDelete, onToggleSelect }: ExpenseRowProps) {
  const { palette } = useTheme();
  const actions = entryActions(entry, capabilities);
  const paid = entry.status === 'PAID';

  let status: ReactNode;
  if (busy) {
    status = <ActivityIndicator color={palette.accent} />;
  } else if (selecting && !paid) {
    status = (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Selecionar: ${entry.description}`}
        accessibilityState={{ checked: !!selected }}
        onPress={() => onToggleSelect?.(entry)}
        style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="title2" tone={selected ? 'accent' : 'muted'} accessible={false}>
          {selected ? '●' : '○'}
        </Text>
      </Pressable>
    );
  } else if (paid) {
    status = (
      <View style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
        <Text variant="title3" tone="success" accessible={false}>
          ✓
        </Text>
      </View>
    );
  } else if (actions.pay) {
    status = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Marcar como pago: ${entry.description}`}
        onPress={() => onPay?.(entry)}
        style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="title2" tone="muted" accessible={false}>
          ○
        </Text>
      </Pressable>
    );
  } else {
    status = <View style={{ width: MIN_TOUCH }} />;
  }

  const editable = actions.edit && !selecting && !busy;
  const body = (
    <View style={{ flex: 1, gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={2}>
          {entry.description}
        </Text>
        <Text variant="headline" tabular>
          {formatBRL(entry.amount)}
        </Text>
      </View>
      <Text variant="subheadline" tone="muted" tabular>{`${entry.category} · ${formatCivilDate(entry.date)}`}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' }}>
        {hidePaymentLine ? (
          <View />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
            <Text variant="subheadline" tone="muted">
              {entry.card?.name ?? 'PIX'}
            </Text>
            {showInvoiceChip(entry) ? (
              <View style={{ borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2 }}>
                <Text variant="caption" tone="muted">{`Fatura ${monthLabelPtBR(entry.referenceMonth)}`}</Text>
              </View>
            ) : null}
          </View>
        )}
        <StatusBadge status={entry.status} busy={busy} />
      </View>
      {paid && entry.paidAt ? <Text variant="footnote" tone="muted" tabular>{`Pago em ${formatInstantDate(entry.paidAt)}`}</Text> : null}
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: selected ? palette.surface2 : palette.surface,
        borderColor: selected ? palette.accent : palette.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        marginHorizontal: space.lg,
        marginBottom: space.sm,
        paddingRight: space.md,
        paddingVertical: space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {status}
        {editable ? (
          <Pressable accessible={false} onPress={() => onEdit?.(entry)} style={{ flex: 1, paddingTop: space.sm }}>
            {body}
          </Pressable>
        ) : selecting && !paid ? (
          <Pressable accessible={false} onPress={() => onToggleSelect?.(entry)} style={{ flex: 1, paddingTop: space.sm }}>
            {body}
          </Pressable>
        ) : (
          <View style={{ flex: 1, paddingTop: space.sm }}>{body}</View>
        )}
      </View>
      {!selecting && !busy && (actions.edit || actions.remove) ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, paddingLeft: MIN_TOUCH }}>
          {actions.edit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar despesa: ${entry.description}`}
              onPress={() => onEdit?.(entry)}
              style={{ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.sm }}
            >
              <Text variant="subheadline" tone="accent" accessible={false}>
                Editar
              </Text>
            </Pressable>
          ) : null}
          {actions.remove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Excluir despesa: ${entry.description}`}
              onPress={() => onDelete?.(entry)}
              style={{ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.sm }}
            >
              <Text variant="subheadline" tone="danger" accessible={false}>
                Excluir
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Linha de receita: sem acoes (DM12). */
export function IncomeRow({ entry }: { entry: EntryDto }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        marginHorizontal: space.lg,
        marginBottom: space.sm,
        padding: space.md,
        gap: space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="headline" style={{ flex: 1 }}>
          {entry.description}
        </Text>
        <Text variant="headline" tabular>
          {formatBRL(entry.amount)}
        </Text>
      </View>
      <Text variant="subheadline" tone="muted" tabular>{`${entry.category} · ${formatCivilDate(entry.date)}`}</Text>
      <StatusBadge status="RECEIVED" />
    </View>
  );
}

export const isInvoicePaid = (invoice: Pick<InvoiceDto, 'totals'>) => toCents(invoice.totals.pending) === 0n;

/** Card de fatura (6.4): o corpo abre o detalhe; "Pagar fatura" so quando ha pendencias. */
export function InvoiceRow({
  invoice,
  busy,
  onOpen,
  onPay,
}: {
  invoice: InvoiceDto;
  busy?: boolean;
  onOpen: (invoice: InvoiceDto) => void;
  onPay: (invoice: InvoiceDto) => void;
}) {
  const { palette } = useTheme();
  const paid = isInvoicePaid(invoice);
  const count = invoice.entryCount;
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        marginHorizontal: space.lg,
        marginBottom: space.sm,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver despesas da fatura ${invoice.card.name}, ${monthLongPtBR(invoice.referenceMonth)}`}
        onPress={() => onOpen(invoice)}
        style={{ gap: space.xs }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="headline" accessible={false}>
            {invoice.card.name}
          </Text>
          {paid ? (
            <Text variant="subheadline" tone="success" accessible={false}>
              ✓ Fatura paga
            </Text>
          ) : null}
        </View>
        <Text
          variant="subheadline"
          tone="muted"
          tabular
          accessible={false}
        >{`Fecha ${formatCivilDate(invoice.closingDate)} · Vence ${formatCivilDate(invoice.dueDate)}`}</Text>
        <AmountPair label="Total" value={invoice.totals.total} />
        <AmountPair label="Pago" value={invoice.totals.paid} dot="success" />
        <AmountPair label="Pendente" value={invoice.totals.pending} dot="warning" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="footnote" tone="muted" accessible={false}>{`${count} ${count === 1 ? 'despesa' : 'despesas'}`}</Text>
          {busy ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <Text tone="muted" accessible={false}>
              ›
            </Text>
          )}
        </View>
      </Pressable>
      {!paid ? (
        <Button
          title="Pagar fatura"
          accessibilityHint={`Fatura ${invoice.card.name} de ${monthLongPtBR(invoice.referenceMonth)}`}
          busy={busy}
          busyTitle="Pagando…"
          kind="secondary"
          onPress={() => onPay(invoice)}
        />
      ) : null}
    </View>
  );
}

export function AmountPair({ label, value, dot, strong }: { label: string; value: string; dot?: 'success' | 'warning'; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {dot ? (
          <Text variant="footnote" tone={dot} accessible={false}>
            ●
          </Text>
        ) : null}
        <Text variant="subheadline" tone="muted">
          {label}
        </Text>
      </View>
      <Text variant={strong ? 'headline' : 'subheadline'} tabular>
        {formatBRL(value)}
      </Text>
    </View>
  );
}

/** Subtotal vindo da API (nunca somado no app, CA17). */
export function SubtotalCard({
  title,
  count,
  noun = ['despesa', 'despesas'],
  totals,
  refreshing,
}: {
  title: string;
  count: number;
  noun?: [string, string];
  totals: { total: string; paid?: string; pending?: string };
  refreshing?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <Card style={{ backgroundColor: palette.surface2, marginHorizontal: space.lg }}>
      <Text variant="footnote" tone="muted">
        {title}
      </Text>
      <Text variant="subheadline">{`${count} ${count === 1 ? noun[0] : noun[1]}`}</Text>
      <AmountPair label="Total" value={totals.total} strong />
      {totals.paid !== undefined ? <AmountPair label="Pago" value={totals.paid} dot="success" /> : null}
      {totals.pending !== undefined ? <AmountPair label="Pendente" value={totals.pending} dot="warning" /> : null}
      {refreshing ? (
        <Text variant="footnote" tone="muted">
          Atualizando…
        </Text>
      ) : null}
    </Card>
  );
}
