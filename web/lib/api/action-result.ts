import "server-only";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { expiredLoginUrl, passwordChangeUrl } from "@/lib/auth/redirect-urls";
import { ApiError } from "./http";
import type { ActionError, ActionResult, FieldIssue } from "./types";

export const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente.";

export function toActionError(error: ApiError): ActionError {
  const details = (error.details ?? {}) as { fields?: FieldIssue[]; missingIds?: string[]; incomeIds?: string[]; retryAfterSeconds?: number };
  return {
    status: error.status,
    code: error.code,
    message: error.message,
    ...(details.fields ? { fields: details.fields } : {}),
    ...(details.missingIds ? { missingIds: details.missingIds } : {}),
    ...(details.incomeIds ? { incomeIds: details.incomeIds } : {}),
    ...(error.status === 429 && typeof details.retryAfterSeconds === "number" ? { retryAfterSeconds: details.retryAfterSeconds } : {}),
  };
}

// Por status/codigo (e nao so pela subclasse): vale tambem para erros que chegam como `ApiError` simples
const isUnauthenticated = (error: unknown): error is ApiError => error instanceof ApiError && error.status === 401 && error.code !== "INVALID_CREDENTIALS";
const isPasswordChangeRequired = (error: unknown): error is ApiError => error instanceof ApiError && error.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED";

/**
 * Traducao de excecoes em resultado de Server Action (ADR 0005 9.5 / 13.2): 401 apaga o cookie e vira `SESSION_EXPIRED`
 * com `redirectUrl` de login; 403 `PASSWORD_CHANGE_REQUIRED` ganha `redirectUrl` para a troca; o resto segue o contrato.
 */
export async function toResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (isUnauthenticated(error)) {
      await clearSessionCookie({ refresh: false });
      return { ok: false, error: { status: 401, code: "SESSION_EXPIRED", message: SESSION_EXPIRED_MESSAGE, redirectUrl: await expiredLoginUrl() } };
    }
    if (isPasswordChangeRequired(error)) {
      return { ok: false, error: { ...toActionError(error), redirectUrl: await passwordChangeUrl() } };
    }
    if (error instanceof ApiError) return { ok: false, error: toActionError(error) };
    return { ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "Erro inesperado." } };
  }
}
