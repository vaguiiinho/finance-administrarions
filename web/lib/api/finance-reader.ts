import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { expiredLoginUrl, passwordChangeUrl } from "@/lib/auth/redirect-urls";
import * as endpoints from "./endpoints";
import { ForbiddenApiError, PasswordChangeRequiredApiError, UnauthenticatedApiError } from "./http";

/** Leituras do finance usadas pelas telas (ADR 0005 9.6, ADR 0013 9.4); mesmas assinaturas de `endpoints.ts`. */
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

let reader: FinanceReader | undefined;

/** Uma instancia por processo (as funcoes com `cache` precisam ser as mesmas em toda a renderizacao). */
export function getFinanceReader(): FinanceReader {
  return (reader ??= buildProtected());
}
