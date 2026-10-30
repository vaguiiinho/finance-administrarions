"use client";

import type { ReactNode } from "react";
import { useAppMode } from "./app-mode";

/**
 * Elementos de escrita e checkboxes de selecao (RF31, CA38): em `readOnly` nao renderiza NADA (nem desabilitado, nem
 * oculto). Os filhos nem sao montados, entao nenhum efeito ou Server Action de escrita roda na demo.
 */
export function WriteOnly({ children }: { children: ReactNode }) {
  return useAppMode().readOnly ? null : <>{children}</>;
}
