/**
 * Modo da tela (ADR 0005 9.6). Valores puros, SEM "use client": os Server Components leem `basePath` e `readOnly` daqui
 * (uma constante exportada por um modulo "use client" chega ao servidor como referencia de cliente, nao como valor).
 */
export interface AppMode {
  kind: "protected" | "demo";
  basePath: "" | "/demo";
  readOnly: boolean;
}
export const PROTECTED_MODE: AppMode = { kind: "protected", basePath: "", readOnly: false };
export const DEMO_MODE: AppMode = { kind: "demo", basePath: "/demo", readOnly: true };
