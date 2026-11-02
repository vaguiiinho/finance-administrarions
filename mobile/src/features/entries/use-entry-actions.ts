import { useCallback, useState } from 'react';
import { classifyApiError, type ClassifiedError } from '@/core/api-errors';
import {
  BATCH_LIMIT,
  DELETE_FAILED_TEXT,
  ENTRY_NOT_FOUND_TEXT,
  FORBIDDEN_DELETE_TEXT,
  INVOICE_CARD_NOT_FOUND_TEXT,
  PAY_FAILED_TEXT,
  PAY_INVOICE_FAILED_TEXT,
} from '@/core/messages';
import type { EntryDto, InvoiceDto } from '@/lib/api/types';
import { monthLongPtBR } from '@/lib/dates/format';
import { formatBRL, sumDecimals } from '@/lib/money/decimal';
import { invoicePaidFeedback, paidFeedback } from '@/lib/entries/payment-feedback';
import { useInvalidateFinance } from '@/data/hooks';
import { useSession } from '@/features/session/session-provider';
import { useDialog, useToast } from '@/ui/feedback';

/** Erros que o cliente HTTP ja trata globalmente (login, atualizacao, troca pendente): a tela nao faz nada. */
const GLOBAL_KINDS = new Set<ClassifiedError['kind']>(['SESSION_EXPIRED', 'PASSWORD_CHANGE_REQUIRED', 'UPDATE_REQUIRED']);
const classify = (error: unknown) => classifyApiError(error as never);

export type BatchOutcome = { status: 'paid' } | { status: 'cancelled' } | { status: 'blocked'; message: string } | { status: 'failed' };

/**
 * Acoes sobre lancamentos (B3, DM14-DM16): pagar, pagar em lote, pagar fatura e excluir com "Desfazer".
 * Mensagens, confirmacoes e regra de invalidacao ficam aqui, fora das telas.
 */
export function useEntryActions() {
  const { api, deferred, refreshMe } = useSession();
  const dialog = useDialog();
  const toast = useToast();
  const invalidateFinance = useInvalidateFinance();
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  const setBusy = useCallback((key: string, on: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const runPay = useCallback(
    async (entry: EntryDto): Promise<void> => {
      for (;;) {
        setBusy(entry.id, true);
        try {
          await api.payEntry(entry.id);
          toast.show({ kind: 'success', message: paidFeedback({ paidCount: 1, alreadyPaidCount: 0 }, entry.description) });
          await invalidateFinance();
          return;
        } catch (error) {
          const c = classify(error);
          if (GLOBAL_KINDS.has(c.kind)) return;
          if (c.kind === 'NOT_FOUND') {
            toast.show({ kind: 'error', message: ENTRY_NOT_FOUND_TEXT });
            await invalidateFinance();
            return;
          }
          if (c.kind === 'UNPROCESSABLE') {
            toast.show({ kind: 'error', message: 'Esta despesa não pode ser marcada como paga.' });
            await invalidateFinance();
            return;
          }
          setBusy(entry.id, false);
          const retry = await dialog.confirm({ title: PAY_FAILED_TEXT, confirmLabel: 'Tentar novamente', cancelLabel: 'OK' });
          if (!retry) return;
        } finally {
          setBusy(entry.id, false);
        }
      }
    },
    [api, dialog, invalidateFinance, setBusy, toast],
  );

  /** DM15: pagar uma despesa pendente (sempre com confirmacao: a API nao desmarca). */
  const payOne = useCallback(
    async (entry: EntryDto) => {
      const confirmed = await dialog.confirm({
        title: `Marcar “${entry.description}” como pago?`,
        message: `Total: ${formatBRL(entry.amount)}`,
        confirmLabel: 'Confirmar',
      });
      if (confirmed) await runPay(entry);
    },
    [dialog, runPay],
  );

  /** DM16: pagar em lote (1-100, tudo ou nada). */
  const payBatch = useCallback(
    async (items: readonly EntryDto[]): Promise<BatchOutcome> => {
      if (items.length === 0) return { status: 'cancelled' };
      if (items.length > BATCH_LIMIT) {
        const message = `Selecione no máximo ${BATCH_LIMIT} despesas por vez.`;
        toast.show({ kind: 'error', message });
        return { status: 'blocked', message };
      }
      const total = sumDecimals(items.map((i) => i.amount));
      const listed = items.slice(0, 5).map((i) => `${i.description} ${formatBRL(i.amount)}`);
      const rest = items.length - listed.length;
      const noun = items.length === 1 ? 'despesa' : 'despesas';
      const confirmed = await dialog.confirm({
        title: `Marcar ${items.length} ${noun} como ${items.length === 1 ? 'paga' : 'pagas'}?`,
        message: [`Total: ${formatBRL(total)}`, ...listed, rest > 0 ? `e mais ${rest}` : ''].filter(Boolean).join('\n'),
        confirmLabel: 'Confirmar',
      });
      if (!confirmed) return { status: 'cancelled' };
      const ids = items.map((i) => i.id);
      for (;;) {
        try {
          const result = await api.payEntries(ids);
          toast.show({
            kind: 'success',
            message: paidFeedback({ paidCount: result.paidIds?.length ?? ids.length, alreadyPaidCount: result.alreadyPaidIds?.length ?? 0 }),
          });
          await invalidateFinance();
          return { status: 'paid' };
        } catch (error) {
          const c = classify(error);
          if (GLOBAL_KINDS.has(c.kind)) return { status: 'failed' };
          if (c.kind === 'NOT_FOUND' || c.kind === 'UNPROCESSABLE') {
            const missing = c.missingIds?.length ?? c.incomeIds?.length ?? 0;
            const message =
              c.kind === 'NOT_FOUND'
                ? `Nenhuma despesa foi alterada. ${missing || 'Algumas'} ${missing === 1 ? 'despesa selecionada não foi encontrada' : 'despesas selecionadas não foram encontradas'}.`
                : 'Nenhuma despesa foi alterada. A seleção inclui itens que não podem ser pagos.';
            await invalidateFinance();
            return { status: 'blocked', message };
          }
          const retry = await dialog.confirm({ title: PAY_FAILED_TEXT, confirmLabel: 'Tentar novamente', cancelLabel: 'OK' });
          if (!retry) return { status: 'failed' };
        }
      }
    },
    [api, dialog, invalidateFinance, toast],
  );

  /** Pagar fatura (5.14). `gone`: o cartao nao existe mais (o detalhe volta a lista). */
  const payInvoice = useCallback(
    async (invoice: InvoiceDto): Promise<'paid' | 'cancelled' | 'gone' | 'failed'> => {
      const key = `invoice:${invoice.card.id}:${invoice.referenceMonth}`;
      const lines = [
        `Vence em ${invoice.dueDate.split('-').reverse().join('/')}`,
        invoice.pendingCount > 0 ? `${invoice.pendingCount} ${invoice.pendingCount === 1 ? 'lançamento pendente' : 'lançamentos pendentes'}` : '',
        `Total: ${formatBRL(invoice.totals.pending)}`,
        'Serão pagas as despesas pendentes desta fatura no momento da confirmação.',
      ].filter(Boolean);
      const confirmed = await dialog.confirm({
        title: `Pagar a fatura ${invoice.card.name} de ${monthLongPtBR(invoice.referenceMonth)}?`,
        message: lines.join('\n'),
        confirmLabel: 'Confirmar',
      });
      if (!confirmed) return 'cancelled';
      for (;;) {
        setBusy(key, true);
        try {
          const result = await api.payInvoice(invoice.card.id, invoice.referenceMonth);
          toast.show({ kind: 'success', message: invoicePaidFeedback(invoice, result) });
          await invalidateFinance();
          return 'paid';
        } catch (error) {
          const c = classify(error);
          if (GLOBAL_KINDS.has(c.kind)) return 'failed';
          if (c.kind === 'NOT_FOUND') {
            toast.show({ kind: 'error', message: INVOICE_CARD_NOT_FOUND_TEXT });
            await invalidateFinance();
            return 'gone';
          }
          setBusy(key, false);
          const retry = await dialog.confirm({ title: PAY_INVOICE_FAILED_TEXT, confirmLabel: 'Tentar novamente', cancelLabel: 'OK' });
          if (!retry) return 'failed';
        } finally {
          setBusy(key, false);
        }
      }
    },
    [api, dialog, invalidateFinance, setBusy, toast],
  );

  /** Excluir (5.16): confirmacao, linha some, DELETE so ao fim do "Desfazer" (5 s). */
  const removeExpense = useCallback(
    async (entry: Pick<EntryDto, 'id' | 'description'>): Promise<boolean> => {
      const confirmed = await dialog.confirm({
        title: `Excluir “${entry.description}”?`,
        message: 'O lançamento será removido permanentemente dos resumos e das faturas.',
        confirmLabel: 'Excluir',
        destructive: true,
      });
      if (!confirmed) return false;
      deferred.schedule(entry.id, async () => {
        try {
          await api.deleteExpense(entry.id);
        } catch (error) {
          const c = classify(error);
          if (GLOBAL_KINDS.has(c.kind)) return;
          if (c.kind === 'FORBIDDEN') {
            toast.show({ kind: 'error', message: FORBIDDEN_DELETE_TEXT });
            void refreshMe();
            return;
          }
          if (c.kind !== 'NOT_FOUND') {
            toast.show({ kind: 'error', message: DELETE_FAILED_TEXT });
            return;
          }
        }
        await invalidateFinance();
      });
      toast.show({
        kind: 'success',
        message: 'Despesa excluída.',
        action: {
          label: 'Desfazer',
          onPress: () => {
            if (deferred.undo(entry.id)) toast.show({ kind: 'info', message: 'Exclusão desfeita.' });
          },
        },
      });
      return true;
    },
    [api, deferred, dialog, invalidateFinance, refreshMe, toast],
  );

  return { busyIds, payOne, payBatch, payInvoice, removeExpense };
}
