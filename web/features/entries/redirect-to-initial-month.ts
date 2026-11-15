import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import type { RawSearchParams } from "@/lib/filters/entries-search-params";
import { fallbackMonthHref, hasMonthParam, initialMonthHref, type InitialMonthDecision } from "@/lib/filters/initial-month";

/**
 * Sem `month` na URL, resolve o mes inicial e redireciona (replace) mantendo os demais parametros (ADR 0007 7.2).
 * Com `month` (valido ou nao) nao faz nada. Falha ou timeout da leitura -> `month=<M do web>`, sem aviso (RNF02);
 * redirects de sessao (401/403) e not-found vindos do reader sao repassados.
 */
export async function redirectToInitialMonth(
  searchParams: RawSearchParams,
  reader: { getInitialMonth: () => Promise<InitialMonthDecision> },
  now: Date = new Date(),
): Promise<void> {
  if (hasMonthParam(searchParams)) return;
  let href: string;
  try {
    href = initialMonthHref(searchParams, await reader.getInitialMonth());
  } catch (error) {
    unstable_rethrow(error);
    href = fallbackMonthHref(searchParams, now);
  }
  redirect(href);
}
