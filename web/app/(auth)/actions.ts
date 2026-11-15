"use server";

import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/http";
import { login, logout } from "@/lib/api/identity-client";
import type { FormState } from "@/lib/auth/form-state";
import { fieldMessage } from "@/lib/auth/field-messages";
import { isDemoHintEnabled } from "@/lib/auth/demo-hint";
import { safeNext } from "@/lib/auth/next-param";
import { clearSessionCookie, writeSessionCookie } from "@/lib/auth/session-cookie";

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

/** A1 (ADR 0005 9.5). Sucesso grava o cookie e redireciona; erros viram `FormState` (nunca devolve a senha). */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email");
  const password = text(formData, "password");
  const next = safeNext(text(formData, "next"));

  let mustChangePassword: boolean;
  try {
    const result = await login(email, password);
    await writeSessionCookie(result.session);
    mustChangePassword = result.user.mustChangePassword;
  } catch (error) {
    return loginFailure(error, email);
  }
  // fora do try/catch: redirect() lanca NEXT_REDIRECT
  redirect(mustChangePassword ? `/account/password?next=${encodeURIComponent(next)}` : next);
}

function loginFailure(error: unknown, email: string): FormState {
  const values = { email };
  if (error instanceof ApiError) {
    if (error.status === 401 && error.code === "INVALID_CREDENTIALS") return { status: "error", code: error.code, message: "E-mail ou senha inválidos.", values };
    if (error.status === 429) {
      const seconds = (error.details as { retryAfterSeconds?: number } | null)?.retryAfterSeconds;
      return { status: "error", code: "TOO_MANY_ATTEMPTS", ...(typeof seconds === "number" ? { retryAfterSeconds: seconds } : {}), values };
    }
    if (error.status === 400) {
      const issues = (error.details as { fields?: { field: string; code: string }[] } | null)?.fields ?? [];
      // com a dica ligada o rotulo e "E-mail ou usuario": a mensagem de obrigatorio acompanha (design DR2)
      const emailField = isDemoHintEnabled() ? "identifier" : "email";
      const fields = Object.fromEntries(issues.map((issue) => [issue.field, fieldMessage("login", issue.field === "email" ? emailField : issue.field, issue.code)]));
      if (Object.keys(fields).length > 0) return { status: "error", code: "VALIDATION_ERROR", fields, values };
    }
    return { status: "error", code: error.status === 0 ? "NETWORK_ERROR" : error.code, values };
  }
  return { status: "error", code: "INTERNAL_ERROR", values };
}

/** A2: ignora falha da API (inclusive 401), sempre apaga o cookie e vai para o login (RF06). Nunca por GET. */
export async function logoutAction(): Promise<void> {
  try {
    await logout();
  } catch {
    // a sessao pode ja ter acabado; o cookie sai de qualquer forma
  }
  await clearSessionCookie();
  redirect("/login");
}
