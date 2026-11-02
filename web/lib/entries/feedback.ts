import { formatCivilDate, monthLabelPtBR, monthLongPtBR } from "@/lib/dates/format";
import { changeFilter, changeMonth, changeTab, clearExpenseFilters, clearInvoiceFilters, entriesHref, type EntriesState } from "@/lib/filters/entries-search-params";
import type { EntryDto } from "@/lib/api/types";

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

/** O lancamento aparece com os filtros atuais da aba ativa? (design 3.9.2: so entao ha destaque) */
export function matchesFilters(entry: EntryDto, state: EntriesState): boolean {
  if (state.tab === "income") {
    const c = state.incomes.category;
    return !c || entry.category.toLowerCase() === c.toLowerCase();
  }
  if (state.tab === "invoices") {
    // Fatura sob filtro: compra no cartao e sempre PENDENTE (fica em Pendente e Todos; some sob Pago)
    return state.invoices.status !== "PAID";
  }
  const { status, category, card } = state.expenses;
  if (status !== "ALL" && entry.status !== status) return false;
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
  const withMonthAndTab = (month: string) => entriesHref(changeTab(changeMonth({ ...state, expenses: { status: "ALL" }, incomes: {} }, month), targetTab));

  if (entry.referenceMonth !== state.month) {
    return {
      message: `${message} Ela está em ${monthLongPtBR(entry.referenceMonth)}.`,
      action: { label: `Ver ${monthLongPtBR(entry.referenceMonth).split(" ")[0]}`, href: withMonthAndTab(entry.referenceMonth) },
    };
  }
  if (state.tab === "invoices") {
    if (entry.paymentMethod === "CARD") {
      if (matchesFilters(entry, state)) return { message };
      // RF22/CA57: a fatura nao aparece sob "Pago"; "Limpar filtros" leva a f_status=ALL, sem tocar em Despesas (RF19)
      return { message: `${message} Ela não aparece nos filtros atuais.`, action: { label: "Limpar filtros", href: entriesHref(clearInvoiceFilters(state)) } };
    }
    return { message, action: { label: entry.type === "INCOME" ? "Ver receitas" : "Ver despesas", href: withMonthAndTab(state.month) } };
  }
  if (state.tab !== targetTab) {
    return { message, action: { label: entry.type === "INCOME" ? "Ver receitas" : "Ver despesas", href: withMonthAndTab(state.month) } };
  }
  if (!matchesFilters(entry, state)) {
    const cleared = state.tab === "income" ? changeFilter(state, { r_category: undefined }) : clearExpenseFilters(state);
    return { message: `${message} Ela não aparece nos filtros atuais.`, action: { label: "Limpar filtros", href: entriesHref(cleared) } };
  }
  return { message };
}

export { countLabel, invoicePaidFeedback, paidFeedback } from "./payment-feedback";
