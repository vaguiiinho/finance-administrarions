import { toCents, parseMoneyInput } from "@/lib/money/decimal";
import type { CardPayload, CreateEntryPayload, EntryType, FieldIssue, PaymentMethod, UpdateExpensePayload } from "@/lib/api/types";

/**
 * Regras de UI do formulario "Novo lancamento" (design 3.9). A API e a fonte da verdade: aqui so ha
 * validacao de apoio (campos obrigatorios, tamanhos) e a montagem do payload conforme ADR 9.4 / P31 / B8.
 */
export interface EntryFormValues {
  type: EntryType;
  description: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
  /** Texto do campo (mascara pt-BR, ex.: "123,45") */
  amount: string;
  /** Escolha do usuario; guardada mesmo quando a Receita a forca para PIX (CA73). */
  paymentMethod: PaymentMethod;
  cardId: string;
  /** "Ainda nao paguei"; guardado quando o campo deixa de ser aplicavel. */
  notPaid: boolean;
}

export type EntryFormField = "type" | "description" | "category" | "date" | "amount" | "paymentMethod" | "cardId";
export type EntryFormErrors = Partial<Record<EntryFormField, string>>;

export const DESCRIPTION_MAX = 120;
export const CATEGORY_MAX = 50;
export const AMOUNT_MAX_CENTS = 999_999_999_999n; // R$ 9.999.999.999,99

export function initialEntryForm(today: string): EntryFormValues {
  return { type: "EXPENSE", description: "", category: "", date: today, amount: "", paymentMethod: "PIX", cardId: "", notPaid: false };
}

/** Forma efetiva: Receita e sempre PIX. */
export function effectivePaymentMethod(form: Pick<EntryFormValues, "type" | "paymentMethod">): PaymentMethod {
  return form.type === "INCOME" ? "PIX" : form.paymentMethod;
}

export const isCardExpense = (form: EntryFormValues) => form.type === "EXPENSE" && form.paymentMethod === "CARD";
export const isPixExpense = (form: EntryFormValues) => form.type === "EXPENSE" && form.paymentMethod === "PIX";

/** Linha "Status inicial" (D23), sempre visivel. */
export function initialStatusText(form: EntryFormValues): string {
  if (form.type === "INCOME") return "Status inicial: recebida.";
  if (form.paymentMethod === "CARD") return "Status inicial: pendente, na fatura do cartão.";
  return form.notPaid ? "Status inicial: pendente. Você poderá marcá-la como paga depois." : "Status inicial: paga.";
}

function isRealCivilDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= last;
}

export function validateEntryForm(form: EntryFormValues): EntryFormErrors {
  const errors: EntryFormErrors = {};
  const description = form.description.trim();
  const category = form.category.trim();
  if (!description) errors.description = "Informe a descrição.";
  else if (description.length > DESCRIPTION_MAX) errors.description = "A descrição deve ter no máximo 120 caracteres.";
  if (!category) errors.category = "Informe a categoria.";
  else if (category.length > CATEGORY_MAX) errors.category = "A categoria deve ter no máximo 50 caracteres.";
  if (!isRealCivilDate(form.date)) errors.date = "Informe uma data válida.";
  const amount = parseMoneyInput(form.amount);
  if (amount === null || toCents(amount) <= 0n) errors.amount = "Informe um valor maior que zero.";
  else if (toCents(amount) > AMOUNT_MAX_CENTS) errors.amount = "O valor máximo é R$ 9.999.999.999,99.";
  if (isCardExpense(form) && !form.cardId) errors.cardId = "Escolha o cartão.";
  return errors;
}

/**
 * Payload de E1. `paid: false` SOMENTE com Despesa + PIX + "Ainda nao paguei"; nunca `paid: true`, nem `paid`
 * em Receita ou Cartao (P31). Status, referenceMonth e datas da fatura nunca sao enviados (P24, B8: a data nao muda o envio).
 */
export function buildCreateEntryPayload(form: EntryFormValues): CreateEntryPayload {
  const amount = parseMoneyInput(form.amount);
  if (amount === null) throw new RangeError("valor invalido");
  const paymentMethod = effectivePaymentMethod(form);
  return {
    type: form.type,
    description: form.description.trim(),
    category: form.category.trim(),
    date: form.date,
    amount,
    paymentMethod,
    ...(isCardExpense(form) ? { cardId: form.cardId } : {}),
    ...(isPixExpense(form) && form.notPaid ? { paid: false } : {}),
  };
}

/** Payload de E3 (editar despesa): so descricao, categoria, data e valor (ADR 0011 6.5, DM12). Extraido do EditExpenseDrawer. */
export function buildUpdateExpensePayload(form: Pick<EntryFormValues, "description" | "category" | "date" | "amount">): UpdateExpensePayload {
  const amount = parseMoneyInput(form.amount);
  if (amount === null) throw new RangeError("valor invalido");
  return { description: form.description.trim(), category: form.category.trim(), date: form.date, amount };
}

/** Mapeia os campos do 400 da API (ADR 6.3) para os campos do formulario; o que nao mapeia vai para o resumo. */
export function mapApiFieldIssues(issues: readonly FieldIssue[] | undefined): { fields: EntryFormErrors; unmapped: string[] } {
  const fieldMap: Record<string, EntryFormField> = {
    type: "type",
    description: "description",
    category: "category",
    date: "date",
    amount: "amount",
    paymentMethod: "paymentMethod",
    cardId: "cardId",
    paid: "paymentMethod",
  };
  const fields: EntryFormErrors = {};
  const unmapped: string[] = [];
  for (const issue of issues ?? []) {
    const target = fieldMap[issue.field];
    if (target) fields[target] ??= issue.message;
    else unmapped.push(issue.message);
  }
  return { fields, unmapped };
}

// ---------------------------------------------------------------------------
// Cartao (painel embutido e drawer de /cards): nome 1-50, dias 1-31 (RF01)
// ---------------------------------------------------------------------------
export interface CardFormValues {
  name: string;
  closingDay: string;
  dueDay: string;
}
export type CardFormErrors = Partial<Record<keyof CardFormValues, string>>;

export const CARD_NAME_MAX = 50;

const parseDay = (value: string): number | null => {
  const text = value.trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 31 ? n : null;
};

export function validateCardForm(form: CardFormValues): CardFormErrors {
  const errors: CardFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Informe o nome.";
  else if (name.length > CARD_NAME_MAX) errors.name = "O nome deve ter no máximo 50 caracteres.";
  if (parseDay(form.closingDay) === null) errors.closingDay = "Informe um dia entre 1 e 31.";
  if (parseDay(form.dueDay) === null) errors.dueDay = "Informe um dia entre 1 e 31.";
  return errors;
}

export function buildCardPayload(form: CardFormValues): CardPayload {
  return { name: form.name.trim(), closingDay: parseDay(form.closingDay) ?? 0, dueDay: parseDay(form.dueDay) ?? 0 };
}

export function mapCardFieldIssues(issues: readonly FieldIssue[] | undefined): { fields: CardFormErrors; unmapped: string[] } {
  const fields: CardFormErrors = {};
  const unmapped: string[] = [];
  for (const issue of issues ?? []) {
    if (issue.field === "name" || issue.field === "closingDay" || issue.field === "dueDay") fields[issue.field] ??= issue.message;
    else unmapped.push(issue.message);
  }
  return { fields, unmapped };
}
