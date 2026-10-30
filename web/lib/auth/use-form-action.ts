"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE, type FormState } from "./form-state";

/**
 * `useActionState` para as Server Actions de formulario da Feature A. Cada resposta ganha `at` (carimbo do navegador);
 * uma falha de transporte (action que rejeita) vira estado `NETWORK_ERROR` em vez de derrubar a arvore (error boundary).
 */
export function useFormAction(action: (prev: FormState, data: FormData) => Promise<FormState>) {
  return useActionState(async (prev: FormState, data: FormData): Promise<FormState> => {
    try {
      return { ...(await action(prev, data)), at: Date.now() };
    } catch {
      return { status: "error", code: "NETWORK_ERROR", at: Date.now() };
    }
  }, INITIAL_FORM_STATE);
}
