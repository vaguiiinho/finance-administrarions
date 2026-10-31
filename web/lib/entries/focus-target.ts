import type { StatusFilter } from "@/lib/filters/entries-search-params";

/**
 * Destino do foco depois de pagar (ADR 0007 7.5, RF21). Decide pelo FILTRO, nao pela existencia do ref: a revalidacao
 * pode ja ter desmontado o bloco. Sob "Todos" o item permanece (foco no bloco); nos demais ele sai (foco no h2 do painel).
 */
export function focusTargetAfterPay(status: StatusFilter): "panel" | "block" {
  return status === "ALL" ? "block" : "panel";
}
