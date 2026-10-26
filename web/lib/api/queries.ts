import "server-only";
import { cache } from "react";
import { listCards, listCategories, getSummary } from "./endpoints";
import { ApiError } from "./http";

/** Leituras deduplicadas dentro da mesma renderizacao (resumo, painel, drawer e filtros compartilham C2/E6/S1). */
export const getSummaryCached = cache(getSummary);
export const listCardsCached = cache(listCards);
export const listCategoriesCached = cache(listCategories);

export type Settled<T> = { ok: true; data: T } | { ok: false };

/** Falha de uma leitura auxiliar (cartoes, categorias) nao derruba a tela: a UI mostra aviso e "Tentar novamente". */
export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch {
    return { ok: false };
  }
}

export const isBadRequest = (error: unknown): boolean => error instanceof ApiError && error.status === 400;
