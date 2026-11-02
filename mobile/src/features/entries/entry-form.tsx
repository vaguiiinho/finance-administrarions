import { useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { classifyApiError, withFieldMessages } from '@/core/api-errors';
import { isoToDateInput, maskDateInput, parseDateInput } from '@/core/date-input';
import { summarizeInstallments } from '@/core/installment-summary';
import { queryKeys } from '@/core/query-keys';
import {
  CARD_GONE_TEXT,
  ENTRY_NOT_FOUND_TEXT,
  FORBIDDEN_EDIT_TEXT,
  NETWORK_TEXT,
  NO_CARDS_TEXT,
  PAID_CARD_DATE_LOCKED_TEXT,
  UPDATE_FAILED_TEXT,
} from '@/core/messages';
import { matchCategories } from '@/core/text-search';
import type { CardDto, EntryDto, PaymentMethod } from '@/lib/api/types';
import { formatCivilDate, monthLabelPtBR, monthLongPtBR, todaySP } from '@/lib/dates/format';
import {
  buildCreateEntryPayload,
  buildUpdateExpensePayload,
  initialStatusText,
  mapApiFieldIssues,
  validateEntryForm,
  type EntryFormErrors,
  type EntryFormValues,
} from '@/lib/entries/form';
import { previewInstallments } from '@/lib/entries/installments';
import { formatBRL, parseMoneyInput } from '@/lib/money/decimal';
import { useCards, useCategories, useInvalidateFinance } from '@/data/hooks';
import { useDismissModal } from '@/features/navigation';
import { useEntryActions } from './use-entry-actions';
import { useSession } from '@/features/session/session-provider';
import { useViewState } from '@/features/view-state/view-state';
import { Button, Card, Field, InlineAlert, Screen, Segmented, SwitchRow } from '@/ui/controls';
import { useDialog, useToast } from '@/ui/feedback';
import { Text } from '@/ui/Text';
import { MIN_TOUCH, space } from '@/ui/tokens';

export type EntryFormMode = 'expense' | 'installments' | 'income' | 'edit';

const TITLES: Record<EntryFormMode, string> = {
  expense: 'Nova despesa',
  installments: 'Nova despesa parcelada',
  income: 'Nova receita',
  edit: 'Editar despesa',
};
const STARTER_EXPENSE = ['Moradia', 'Mercado', 'Transporte', 'Saúde', 'Lazer'];
const STARTER_INCOME = ['Salário', 'Freelance'];

type ExtraErrors = { installments?: string };
const INSTALLMENTS_ERROR = 'Informe de 2 a 36 parcelas.';

/** "1234.50" -> "1.234,50" (texto do campo Valor ao sair do campo / ao editar). */
function amountToField(amount: string): string {
  return formatBRL(amount).replace(/^R\$ /, '');
}

export function EntryForm({ mode, entry }: { mode: EntryFormMode; entry?: EntryDto }) {
  const editing = mode === 'edit' && entry !== undefined;
  const { api, refreshMe } = useSession();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const queryClient = useQueryClient();
  const invalidateFinance = useInvalidateFinance();
  const dismissModal = useDismissModal();
  const { finances, dashboardMonth } = useViewState();
  const categories = useCategories();
  const cards = useCards();

  const baseline = useMemo(
    () => ({
      description: entry?.description ?? '',
      category: entry?.category ?? '',
      dateText: isoToDateInput(entry?.date ?? todaySP()),
      amount: entry ? amountToField(entry.amount) : '',
    }),
    [entry],
  );

  const [description, setDescription] = useState(baseline.description);
  const [category, setCategory] = useState(baseline.category);
  const [dateText, setDateText] = useState(baseline.dateText);
  const [amount, setAmount] = useState(baseline.amount);
  const [method, setMethod] = useState<PaymentMethod>(entry?.paymentMethod ?? 'PIX');
  const [cardId, setCardId] = useState(entry?.card?.id ?? '');
  const [notPaid, setNotPaid] = useState(false);
  const [count, setCount] = useState('2');
  const [categoryFocused, setCategoryFocused] = useState(false);
  const [moneyFocused, setMoneyFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<EntryFormErrors & ExtraErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const type = mode === 'income' ? 'INCOME' : 'EXPENSE';
  const date = parseDateInput(dateText);
  // Ao escolher "Cartao", o primeiro cartao vem selecionado (o seletor continua disponivel).
  const selectedCardId = cardId || (!editing && method === 'CARD' ? (cards.data?.[0]?.id ?? '') : '');
  const values: EntryFormValues = { type, description, category, date, amount, paymentMethod: method, cardId: selectedCardId, notPaid };
  const cardList: CardDto[] = cards.data ?? [];
  const noCards = cards.isSuccess && cardList.length === 0;
  const dateLocked = editing && entry.paymentMethod === 'CARD' && entry.status === 'PAID';
  const installmentsCount = Number(count);
  const countValid = /^\d{1,2}$/.test(count.trim()) && installmentsCount >= 2 && installmentsCount <= 36;

  const local = validateEntryForm(values);
  const localInstallments = mode === 'installments' && !countValid ? INSTALLMENTS_ERROR : undefined;
  const preview = mode === 'installments' && countValid && date ? previewInstallments(parseMoneyInput(amount) ?? '', installmentsCount, date) : null;
  const show = (field: keyof EntryFormErrors) => serverErrors[field] ?? (submitted ? local[field] : undefined);

  const dirty =
    description !== baseline.description ||
    category !== baseline.category ||
    dateText !== baseline.dateText ||
    amount !== baseline.amount ||
    (!editing && (notPaid || method !== 'PIX' || count !== '2'));

  const clearServerError = (field: keyof (EntryFormErrors & ExtraErrors)) => {
    setBanner(null);
    setServerErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const reset = () => {
    setDescription('');
    setCategory('');
    setDateText(isoToDateInput(todaySP()));
    setAmount('');
    setMethod('PIX');
    setCardId('');
    setNotPaid(false);
    setCount('2');
    setSubmitted(false);
    setServerErrors({});
    setBanner(null);
  };

  const close = () => {
    if (!dismissModal()) router.replace('/dashboard' as never);
  };

  const cancel = async () => {
    if (dirty) {
      const discard = await dialog.confirm({ title: 'Descartar alterações?', confirmLabel: 'Descartar', cancelLabel: 'Continuar editando', destructive: true });
      if (!discard) return;
    }
    close();
  };

  const monthHint = (referenceMonth: string | undefined): string | null => {
    const viewing = finances.month ?? dashboardMonth;
    return referenceMonth && referenceMonth !== viewing ? `Em ${monthLongPtBR(referenceMonth)}.` : null;
  };

  const submit = async () => {
    if (submitting.current) return; // envio duplo (CA27): um unico POST/PUT
    setSubmitted(true);
    setBanner(null);
    if (Object.keys(local).length > 0 || localInstallments) return;
    if (
      editing &&
      description.trim() === baseline.description &&
      category.trim() === baseline.category &&
      date === entry.date &&
      parseMoneyInput(amount) === entry.amount
    ) {
      close(); // sem alteracoes: fecha sem chamada
      return;
    }

    submitting.current = true;
    setBusy(true);
    try {
      if (editing) {
        const original = buildUpdateExpensePayload({
          description: entry.description,
          category: entry.category,
          date: entry.date,
          amount: amountToField(entry.amount),
        });
        await api.updateExpense(entry.id, buildUpdateExpensePayload(values));
        void invalidateFinance();
        toast.show({
          kind: 'success',
          message: 'Despesa atualizada.',
          action: {
            label: 'Desfazer',
            onPress: () => {
              void api
                .updateExpense(entry.id, original)
                .then(async () => {
                  toast.show({ kind: 'success', message: 'Alteração desfeita.' });
                  await invalidateFinance();
                })
                .catch(() => toast.show({ kind: 'error', message: 'Não foi possível desfazer. A despesa ficou com os dados novos.' }));
            },
          },
        });
        close();
        return;
      }

      if (mode === 'installments') {
        const base = buildCreateEntryPayload(values);
        const { paid: _paid, type: _type, ...rest } = base;
        void _paid;
        void _type;
        await api.createInstallments({ ...rest, installments: installmentsCount });
        void invalidateFinance();
        toast.show({ kind: 'success', message: `${installmentsCount} parcelas criadas.` });
      } else {
        const created = await api.createEntry(buildCreateEntryPayload(values));
        void invalidateFinance();
        const lines: string[] = [];
        if (created?.card && created.invoice && created.referenceMonth) {
          lines.push(`Na fatura de ${monthLabelPtBR(created.referenceMonth)} do ${created.card.name}, vence ${formatCivilDate(created.invoice.dueDate)}.`);
        }
        const hint = monthHint(created?.referenceMonth);
        if (hint) lines.push(hint);
        toast.show({ kind: 'success', message: mode === 'income' ? 'Receita criada.' : 'Despesa criada.', detail: lines.join(' ') || undefined });
      }
      if (!dismissModal()) reset();
    } catch (error) {
      const c = classifyApiError(error as never);
      switch (c.kind) {
        case 'VALIDATION': {
          const mapped = mapApiFieldIssues(withFieldMessages(c.fields));
          const extra: ExtraErrors = {};
          const installmentIssue = (c.fields ?? []).find((f) => f.field === 'installments');
          if (installmentIssue) extra.installments = INSTALLMENTS_ERROR;
          setServerErrors({ ...mapped.fields, ...extra });
          if (mapped.unmapped[0]) setBanner(mapped.unmapped[0]);
          else if (Object.keys(mapped.fields).length === 0 && !installmentIssue) setBanner('Revise os campos e tente novamente.');
          break;
        }
        case 'NOT_FOUND':
          if (c.code === 'CARD_NOT_FOUND') {
            setServerErrors({ cardId: CARD_GONE_TEXT });
            setCardId('');
            void queryClient.invalidateQueries({ queryKey: queryKeys.cards() });
          } else {
            toast.show({ kind: 'error', message: ENTRY_NOT_FOUND_TEXT });
            await invalidateFinance();
            close();
          }
          break;
        case 'UNPROCESSABLE':
          if (c.code === 'PAID_CARD_EXPENSE_DATE_LOCKED') setServerErrors({ date: PAID_CARD_DATE_LOCKED_TEXT });
          else setBanner(editing ? UPDATE_FAILED_TEXT : 'Não foi possível salvar. Tente novamente.');
          break;
        case 'FORBIDDEN':
          toast.show({ kind: 'error', message: FORBIDDEN_EDIT_TEXT });
          void refreshMe();
          await invalidateFinance();
          close();
          break;
        case 'NETWORK':
        case 'TIMEOUT':
          setBanner(NETWORK_TEXT);
          break;
        case 'SESSION_EXPIRED':
        case 'PASSWORD_CHANGE_REQUIRED':
        case 'UPDATE_REQUIRED':
          break; // tratados globalmente (descartam o formulario, P09)
        default:
          setBanner(editing ? UPDATE_FAILED_TEXT : 'Não foi possível salvar. Tente novamente.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const suggestions = useMemo(() => {
    const all = categories.data && categories.data.length > 0 ? categories.data : type === 'INCOME' ? STARTER_INCOME : STARTER_EXPENSE;
    return categoryFocused || category === '' ? matchCategories(all, category, 5) : [];
  }, [categories.data, category, categoryFocused, type]);

  const statusLine = editing ? null : mode === 'installments' ? 'Todas nascem pendentes.' : initialStatusText(values);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TOUCH }}>
        <Button title="Cancelar" kind="tertiary" fullWidth={false} onPress={() => void cancel()} disabled={busy} />
        <Text variant="headline" accessibilityRole="header">
          {TITLES[mode]}
        </Text>
        <View style={{ width: 80 }} />
      </View>

      {banner ? <InlineAlert>{banner}</InlineAlert> : null}

      <Field
        label="Descrição"
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          clearServerError('description');
        }}
        error={show('description')}
        editable={!busy}
        autoCapitalize="sentences"
        returnKeyType="next"
      />

      <View style={{ gap: space.sm }}>
        <Field
          label="Categoria"
          value={category}
          onChangeText={(t) => {
            setCategory(t);
            clearServerError('category');
          }}
          onFocus={() => setCategoryFocused(true)}
          onBlur={() => setCategoryFocused(false)}
          error={show('category')}
          editable={!busy}
          autoCapitalize="sentences"
          returnKeyType="next"
        />
        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Usar categoria ${s}`}
                onPress={() => {
                  setCategory(s);
                  clearServerError('category');
                }}
                style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.md }}
              >
                <Text variant="subheadline" tone="accent" accessible={false}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Field
        label={mode === 'installments' ? 'Data da primeira parcela' : 'Data'}
        value={dateText}
        onChangeText={(t) => {
          setDateText(maskDateInput(t));
          clearServerError('date');
        }}
        error={show('date')}
        help={
          dateLocked
            ? PAID_CARD_DATE_LOCKED_TEXT
            : mode === 'installments'
              ? 'As próximas parcelas usam o mesmo dia nos meses seguintes.'
              : editing && entry.paymentMethod === 'CARD'
                ? 'A data de compra pode alterar a fatura do cartão.'
                : undefined
        }
        placeholder="dd/mm/aaaa"
        keyboardType="number-pad"
        disabled={busy || dateLocked}
      />

      <Field
        label={mode === 'installments' ? 'Valor total' : 'Valor'}
        value={amount}
        onChangeText={(t) => {
          setAmount(t);
          clearServerError('amount');
        }}
        onBlur={() => {
          setMoneyFocused(false);
          const parsed = parseMoneyInput(amount);
          if (parsed) setAmount(amountToField(parsed));
        }}
        error={show('amount')}
        prefix="R$"
        keyboardType="decimal-pad"
        onFocus={() => setMoneyFocused(true)}
        editable={!busy}
        placeholder="0,00"
      />

      {moneyFocused ? <Button title="Concluído" kind="tertiary" fullWidth={false} onPress={() => Keyboard.dismiss()} /> : null}

      {mode === 'installments' ? (
        <Field
          label="Parcelas"
          value={count}
          onChangeText={(t) => {
            setCount(t.replace(/\D/g, '').slice(0, 2));
            clearServerError('installments');
          }}
          error={serverErrors.installments ?? (submitted ? localInstallments : undefined)}
          help="De 2 a 36 parcelas."
          keyboardType="number-pad"
          editable={!busy}
        />
      ) : null}

      {mode === 'expense' || mode === 'installments' ? (
        <View style={{ gap: space.sm }}>
          <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
            Forma de pagamento
          </Text>
          <Segmented<PaymentMethod>
            value={method}
            onChange={(m) => {
              setMethod(m);
              clearServerError('cardId');
            }}
            disabled={busy}
            options={[
              { value: 'PIX', label: 'PIX' },
              { value: 'CARD', label: 'Cartão', disabled: noCards },
            ]}
          />
          {noCards ? (
            <Text variant="footnote" tone="muted">
              {NO_CARDS_TEXT}
            </Text>
          ) : null}
          {method === 'CARD' ? (
            <View style={{ gap: space.xs }}>
              {cards.isError ? (
                <View style={{ gap: space.xs }}>
                  <Text variant="footnote" tone="danger">
                    Não foi possível carregar os cartões.
                  </Text>
                  <Button title="Tentar novamente" kind="secondary" fullWidth={false} onPress={() => void cards.refetch()} />
                </View>
              ) : (
                cardList.map((card) => (
                  <Pressable
                    key={card.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Escolher cartão: ${card.name}`}
                    accessibilityState={{ checked: card.id === selectedCardId }}
                    onPress={() => {
                      setCardId(card.id);
                      clearServerError('cardId');
                    }}
                    style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text accessible={false}>{card.name}</Text>
                    <Text tone="accent" accessible={false}>
                      {card.id === selectedCardId ? '✓' : ''}
                    </Text>
                  </Pressable>
                ))
              )}
              {show('cardId') ? (
                <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
                  {show('cardId')}
                </Text>
              ) : null}
            </View>
          ) : null}
          {mode === 'expense' && method === 'PIX' ? <SwitchRow label="Ainda não paguei" value={notPaid} onChange={setNotPaid} /> : null}
        </View>
      ) : null}

      {editing ? (
        <Card>
          <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
            Pagamento
          </Text>
          <Text>{`Forma: ${entry.card?.name ?? 'PIX'}`}</Text>
          <Text>{`Status: ${entry.status === 'PAID' ? 'Pago' : 'Pendente'}`}</Text>
          <Text variant="footnote" tone="muted">
            A forma de pagamento não pode ser alterada.
          </Text>
        </Card>
      ) : null}

      {mode === 'installments' ? (
        <Card>
          <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
            Prévia
          </Text>
          {preview ? (
            <View
              accessible
              accessibilityLabel={`Prévia: ${preview.length} parcelas, total ${formatBRL(parseMoneyInput(amount) ?? '0')}.`}
              style={{ gap: space.xs }}
            >
              <Text variant="subheadline">{`${preview.length} parcelas · total ${formatBRL(parseMoneyInput(amount) ?? '0')}`}</Text>
              <Text variant="headline">{summarizeInstallments(preview)}</Text>
              {preview.slice(0, 6).map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="subheadline" tone="muted" tabular>{`${index + 1}ª parcela · ${formatCivilDate(item.date)}`}</Text>
                  <Text variant="subheadline" tabular>
                    {formatBRL(item.amount)}
                  </Text>
                </View>
              ))}
              {preview.length > 6 ? <Text variant="footnote" tone="muted">{`e mais ${preview.length - 6} parcelas`}</Text> : null}
            </View>
          ) : (
            <Text variant="subheadline" tone="muted">
              Preencha o valor total, as parcelas e a data para ver a prévia.
            </Text>
          )}
        </Card>
      ) : null}

      {statusLine ? (
        <Text variant="footnote" tone="muted">
          {statusLine}
        </Text>
      ) : null}

      <Button
        title="Salvar"
        accessibilityHint={mode === 'installments' && preview ? `Salvar ${preview.length} parcelas` : undefined}
        busy={busy}
        busyTitle="Salvando…"
        onPress={() => void submit()}
      />

      {editing ? <DeleteFromEdit entry={entry} onDone={close} /> : null}
    </Screen>
  );
}

function DeleteFromEdit({ entry, onDone }: { entry: EntryDto; onDone: () => void }) {
  const actions = useEntryActions();
  return (
    <Button
      title="Excluir despesa"
      kind="destructive"
      onPress={() => {
        void actions.removeExpense(entry).then((started) => started && onDone());
      }}
    />
  );
}
