"use client";

import { createContext, useContext, type ReactNode } from "react";
import { PROTECTED_MODE, type AppMode } from "@/lib/app-mode";

export { DEMO_MODE, PROTECTED_MODE, type AppMode } from "@/lib/app-mode";

const AppModeContext = createContext<AppMode>(PROTECTED_MODE);

/** Contexto do modo para os Client Components (`useAppMode`); os Server Components recebem `mode` por prop (ADR 0005 9.6). */
export function AppModeProvider({ mode, children }: { mode: AppMode; children: ReactNode }) {
  return <AppModeContext.Provider value={mode}>{children}</AppModeContext.Provider>;
}
export const useAppMode = (): AppMode => useContext(AppModeContext);
