import "server-only";
import { notFound, redirect } from "next/navigation";
import { expiredLoginUrl, passwordChangeUrl } from "@/lib/auth/redirect-urls";
import { ForbiddenApiError, PasswordChangeRequiredApiError, UnauthenticatedApiError } from "./http";

/**
 * Leituras do identity nas paginas (ADR 0005 9.4): 401 -> login com `reason=expired`; 403 `PASSWORD_CHANGE_REQUIRED` -> troca de
 * senha; 403 `FORBIDDEN` -> not-found. Mesmo contrato do `FinanceReader` protegido.
 */
export async function redirectOnAuthError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UnauthenticatedApiError) redirect(await expiredLoginUrl());
    if (error instanceof PasswordChangeRequiredApiError) redirect(await passwordChangeUrl());
    if (error instanceof ForbiddenApiError) notFound();
    throw error;
  }
}
