import type { ActionResult } from "./types";

/**
 * Server Action que REJEITA (falha de transporte, deploy trocado) vira um resultado de erro generico: o chamador
 * sempre sai do estado "ocupado" e cai na mensagem generica que ja existe para 500/rede.
 */
export async function settleAction<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch {
    return { ok: false, error: { status: 0, code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor." } };
  }
}
