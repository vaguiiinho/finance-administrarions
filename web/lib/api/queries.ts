import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "./http";

export type Settled<T> = { ok: true; data: T } | { ok: false };

/** Falha de uma leitura auxiliar (cartoes, categorias) nao derruba a tela: a UI mostra aviso e "Tentar novamente". */
export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    // redirect()/notFound() dos readers (401, 403) precisam chegar ao Next: nao sao falhas "auxiliares"
    unstable_rethrow(error);
    return { ok: false };
  }
}

export const isBadRequest = (error: unknown): boolean => error instanceof ApiError && error.status === 400;
