import { monthLongPtBR, shiftMonth } from "../lib/dates/format";
import { setScenario, type ScenarioOptions } from "./support";

/**
 * Dados do cenario `custom` do stub (ADR 0007 secao 10): o teste descreve cartoes e lancamentos pelo MES DE REFERENCIA, que e
 * o que a regra do mes inicial le. O stub nao recalcula nada: o que se envia e o que a API "gravou".
 */
const uuid = (p: string, n: number) => `${p}0000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const STAMP = "2026-10-01T12:00:00.000Z";

export interface StubCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  createdAt: string;
  updatedAt: string;
}
export const stubCard = (n: number, name: string, closingDay = 25, dueDay = 5): StubCard => ({ id: uuid("c", n), name, closingDay, dueDay, createdAt: STAMP, updatedAt: STAMP });

interface EntryOpts {
  description?: string;
  amount?: string;
  status?: "PENDING" | "PAID";
  category?: string;
}
const base = (n: number, referenceMonth: string, o: EntryOpts) => {
  const status = o.status ?? "PENDING";
  return {
    id: uuid("e", n),
    type: "EXPENSE" as const,
    description: o.description ?? `Lancamento ${n}`,
    category: o.category ?? "Moradia",
    amount: o.amount ?? "100.00",
    status,
    paidAt: status === "PAID" ? "2026-10-20T13:00:00.000Z" : null,
    referenceMonth,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
};

/** Despesa PIX do mes `month` (ex.: "2026-10"). */
export const pixExpense = (n: number, month: string, o: EntryOpts = {}) => ({ ...base(n, month, o), date: `${month}-10`, paymentMethod: "PIX" as const, card: null, invoice: null });

/** Despesa no cartao cuja fatura (mes de referencia = vencimento) e `month`. */
export const cardExpense = (n: number, card: StubCard, month: string, o: EntryOpts = {}) => {
  const closing = `${shiftMonth(month, -1)}-${String(card.closingDay).padStart(2, "0")}`;
  return {
    ...base(n, month, o),
    date: `${shiftMonth(month, -1)}-${String(Math.max(1, card.closingDay - 5)).padStart(2, "0")}`,
    paymentMethod: "CARD" as const,
    card: { id: card.id, name: card.name },
    invoice: { closingDate: closing, dueDate: `${month}-${String(card.dueDay).padStart(2, "0")}` },
  };
};

export const income = (n: number, month: string, o: EntryOpts = {}) => ({
  ...base(n, month, { ...o, status: "PAID" }),
  type: "INCOME" as const,
  status: "RECEIVED" as const,
  paidAt: null,
  date: `${month}-05`,
  paymentMethod: "PIX" as const,
  card: null,
  invoice: null,
  category: "Salário",
  description: o.description ?? "Salário",
});

export async function seedData(data: { cards?: StubCard[]; entries?: unknown[]; now?: string; demo?: ScenarioOptions["demo"] }, name = "custom", options: ScenarioOptions = {}) {
  await setScenario(name, { ...options, cards: data.cards ?? [], entries: data.entries ?? [], now: data.now, demo: data.demo });
}

/** Mes civil de America/Sao_Paulo no instante real (o web calcula "Mes atual" assim; RNF03). */
export function currentMonthSP(date = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}
export const monthFromNow = (delta: number) => shiftMonth(currentMonthSP(), delta);
export const longMonth = monthLongPtBR;

export const noticeText = {
  nextPending: (from: string, to: string) => `Sem pendências em ${monthLongPtBR(from)}. Mostrando ${monthLongPtBR(to)}, o próximo mês com pendências.`,
  noneAhead: (from: string, to: string) => `Sem pendências de ${monthLongPtBR(from)} em diante. Mostrando ${monthLongPtBR(to)}.`,
};
