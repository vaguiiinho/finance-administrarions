import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { expiredLoginUrl, passwordChangeUrl } from "@/lib/auth/redirect-urls";
import type { InitialMonthDecision } from "@/lib/filters/initial-month";
import * as endpoints from "./endpoints";
import { ForbiddenApiError, PasswordChangeRequiredApiError, UnauthenticatedApiError, request, type Query } from "./http";
import type { CategoryDistribution, CardDto, EntryDto, ExpensesPage, IncomesPage, InvoiceDto, MonthlySeries, TotalsDto } from "./types";

/** Leituras do finance usadas pelas telas (ADR 0005 9.6); mesmas assinaturas de `endpoints.ts`. */
export interface FinanceReader {
  getSummary: typeof endpoints.getSummary;
  listCards: typeof endpoints.listCards;
  listCategories: typeof endpoints.listCategories;
  listInvoices: typeof endpoints.listInvoices;
  getInitialMonth: typeof endpoints.getInitialMonth;
  listInvoiceEntries: typeof endpoints.listInvoiceEntries;
  listExpenses: typeof endpoints.listExpenses;
  listIncomes: typeof endpoints.listIncomes;
  getMonthlySeries: typeof endpoints.getMonthlySeries;
  getCategoryDistribution: typeof endpoints.getCategoryDistribution;
}

/**
 * Leitura protegida (ADR 9.4): 401 (inclusive sem cookie) -> login com `reason=expired`; 403 `PASSWORD_CHANGE_REQUIRED` ->
 * troca de senha; 403 `FORBIDDEN` -> not-found. Layouts nao re-renderizam em navegacao no cliente, por isso o redirect
 * mora aqui, alimentado pela resposta da API.
 */
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UnauthenticatedApiError) redirect(await expiredLoginUrl());
    if (error instanceof PasswordChangeRequiredApiError) redirect(await passwordChangeUrl());
    if (error instanceof ForbiddenApiError) notFound();
    throw error;
  }
}

// Chamadas as funcoes de `endpoints` sao feitas na hora (nao na criacao): o modulo pode ser trocado em testes.
// `cache` do React deduplica resumo, cartoes e categorias dentro da mesma renderizacao (varios blocos leem os mesmos).
function buildProtected(): FinanceReader {
  return {
    getSummary: cache((month: string) => guarded(() => endpoints.getSummary(month))),
    listCards: cache(() => guarded(() => endpoints.listCards())),
    listCategories: cache(() => guarded(() => endpoints.listCategories())),
    listInvoices: (query) => guarded(() => endpoints.listInvoices(query)),
    getInitialMonth: () => guarded(() => endpoints.getInitialMonth()),
    listInvoiceEntries: (cardId, referenceMonth) => guarded(() => endpoints.listInvoiceEntries(cardId, referenceMonth)),
    listExpenses: (query) => guarded(() => endpoints.listExpenses(query)),
    listIncomes: (query) => guarded(() => endpoints.listIncomes(query)),
    getMonthlySeries: (month) => guarded(() => endpoints.getMonthlySeries(month)),
    getCategoryDistribution: (month) => guarded(() => endpoints.getCategoryDistribution(month)),
  };
}

/** `GET /api/demo/*`: publico, sem cookie e sem Bearer; falhas seguem como `ApiError` (nao redirecionam para o login). */
const demoGet = <T>(path: string, query?: Query) => request<T>("GET", `/demo${path}`, { query, auth: "none" });
const enc = encodeURIComponent;

function buildDemo(): FinanceReader {
  return {
    getSummary: cache((month: string) => demoGet<{ month: string; totals: TotalsDto }>("/summary", { month })),
    listCards: cache(() => demoGet<{ items: CardDto[] }>("/cards")),
    listCategories: cache(() => demoGet<{ items: string[] }>("/categories")),
    listInvoices: ({ month, status }) => demoGet<{ month: string; items: InvoiceDto[] }>("/invoices", { month, status }),
    getInitialMonth: () => request<InitialMonthDecision>("GET", "/demo/entries/initial-month", { auth: "none", timeoutMs: endpoints.INITIAL_MONTH_TIMEOUT_MS }),
    listInvoiceEntries: (cardId, referenceMonth) =>
      demoGet<{ card: { id: string; name: string }; referenceMonth: string; items: EntryDto[] }>(`/cards/${enc(cardId)}/invoices/${enc(referenceMonth)}/entries`),
    listExpenses: (query) => demoGet<ExpensesPage>("/entries/expenses", query),
    listIncomes: (query) => demoGet<IncomesPage>("/entries/incomes", query),
    getMonthlySeries: (month) => demoGet<MonthlySeries>("/dashboard/monthly-series", { month }),
    getCategoryDistribution: (month) => demoGet<CategoryDistribution>("/dashboard/category-distribution", { month }),
  };
}

const readers: Partial<Record<"protected" | "demo", FinanceReader>> = {};

/** Uma instancia por tipo (as funcoes com `cache` precisam ser as mesmas em toda a renderizacao). */
export function createFinanceReader(kind: "protected" | "demo"): FinanceReader {
  return (readers[kind] ??= kind === "demo" ? buildDemo() : buildProtected());
}
