import { formatCivilDate, monthLabelPtBR, monthLongPtBR } from "@/lib/dates/format";
import { formatBRL } from "@/lib/money/decimal";
import { changeFilter, changeMonth, changeTab, entriesHref, type EntriesState } from "@/lib/filters/entries-search-params";
import type { EntryDto, InvoiceDto } from "@/lib/api/types";

export interface FeedbackAction {
  label: string;
  href: string;
}

export interface Feedback {
  message: string;
  action?: FeedbackAction;
}

function baseCreatedMessage(entry: EntryDto): string {
  if (entry.type === "INCOME") return "Receita criada.";
  if (entry.paymentMethod === "CARD" && entry.card && entry.invoice) {
    return `Lançamento criado na fatura de ${monthLabelPtBR(entry.referenceMonth)} do ${entry.card.name}, vence ${formatCivilDate(entry.invoice.dueDate)}.`;
  }
  return entry.status === "PAID" ? "Despesa criada como paga." : "Despesa criada como pendente.";
}

function matchesFilters(entry: EntryDto, state: EntriesState): boolean {
  if (state.tab === "income") {
    const c = state.incomes.category;
    return !c || entry.category.toLowerCase() === c.toLowerCase();
  }
  const { status, category, card } = state.expenses;
  if (status && entry.status !== status) return false;
  if (category && entry.category.toLowerCase() !== category.toLowerCase()) return false;
  if (card === "pix") return entry.card === null;
  if (card) return entry.card?.id === card;
  return true;
}

/**
 * Toast pos-criacao (D25): sempre com os dados da RESPOSTA; oferece uma acao quando o lancamento nao aparece
 * no mes/aba/filtros atuais. O teste "aparece aqui?" compara `referenceMonth` e o tipo com a URL.
 */
export function createdFeedback(entry: EntryDto, state: EntriesState): Feedback {
  const message = baseCreatedMessage(entry);
  const targetTab = entry.type === "INCOME" ? "income" : "expenses";
  const withMonthAndTab = (month: string) => entriesHref(changeTab(changeMonth({ ...state, expenses: {}, incomes: {} }, month), targetTab));

  if (entry.referenceMonth !== state.month) {
    return {
      message: `${message} Ela está em ${monthLongPtBR(entry.referenceMonth)}.`,
      action: { label: `Ver ${monthLongPtBR(entry.referenceMonth).split(" ")[0]}`, href: withMonthAndTab(entry.referenceMonth) },
    };
  }
  if (state.tab === "invoices") {
    if (entry.paymentMethod === "CARD") return { message };
    return { message, action: { label: entry.type === "INCOME" ? "Ver receitas" : "Ver despesas", href: withMonthAndTab(state.month) } };
  }
  if (state.tab !== targetTab) {
    return { message, action: { label: entry.type === "INCOME" ? "Ver receitas" : "Ver despesas", href: withMonthAndTab(state.month) } };
  }
  if (!matchesFilters(entry, state)) {
    const cleared = state.tab === "income" ? changeFilter(state, { r_category: undefined }) : changeFilter(state, { d_status: undefined, d_category: undefined, d_card: undefined });
    return { message: `${message} Ela não aparece nos filtros atuais.`, action: { label: "Limpar filtros", href: entriesHref(cleared) } };
  }
  return { message };
}

/** Toast do pagamento da fatura com os valores da RESPOSTA (P21). */
export function invoicePaidFeedback(
  invoice: Pick<InvoiceDto, "card" | "referenceMonth" | "totals">,
  result: { paidCount: number; paidAmount: string },
): string {
  if (result.paidCount === 0) return "Nenhuma despesa pendente nesta fatura. Nada foi alterado.";
  const noun = result.paidCount === 1 ? "despesa" : "despesas";
  const base = `Fatura ${invoice.card.name} de ${monthLabelPtBR(invoice.referenceMonth)} paga: ${result.paidCount} ${noun}, ${formatBRL(result.paidAmount)}.`;
  return result.paidAmount !== invoice.totals.pending ? `${base} O valor difere do exibido porque a fatura mudou.` : base;
}

/** Toast do pagamento individual / em lote. */
export function paidFeedback(result: { paidCount: number; alreadyPaidCount: number }, singleDescription?: string): string {
  if (singleDescription && result.paidCount === 1) return `"${singleDescription}" marcado como pago.`;
  const noun = (n: number) => (n === 1 ? "despesa" : "despesas");
  const paid = `${result.paidCount} ${noun(result.paidCount)} ${result.paidCount === 1 ? "marcada" : "marcadas"} como ${result.paidCount === 1 ? "paga" : "pagas"}.`;
  return result.alreadyPaidCount > 0 ? `${paid} ${result.alreadyPaidCount} já ${result.alreadyPaidCount === 1 ? "estava paga" : "estavam pagas"}.` : paid;
}

/** Contagens em pt-BR com plural explicito. */
export const countLabel = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
