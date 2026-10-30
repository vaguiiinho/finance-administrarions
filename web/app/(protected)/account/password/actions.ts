"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toResult } from "@/lib/api/action-result";
import { changePassword } from "@/lib/api/identity-client";
import { fieldMessage } from "@/lib/auth/field-messages";
import type { FormState } from "@/lib/auth/form-state";
import { safeNext } from "@/lib/auth/next-param";

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * A4. A confirmacao so existe no web (CA10): diferente -> erro de campo sem chamar a API. Sucesso com troca
 * obrigatoria revalida o layout (navbar, menu e footer voltam ao modo completo) e vai para o `next` seguro;
 * a sessao atual continua (o cookie nao e tocado).
 */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const currentPassword = text(formData, "currentPassword");
  const newPassword = text(formData, "newPassword");
  const confirmPassword = text(formData, "confirmPassword");
  const required = text(formData, "mode") === "required";

  if (newPassword !== confirmPassword) {
    return { status: "error", code: "VALIDATION_ERROR", fields: { confirmPassword: "As senhas não conferem." } };
  }

  const result = await toResult(() => changePassword(currentPassword, newPassword));
  if (result.ok) {
    revalidatePath("/", "layout");
    if (required) redirect(safeNext(text(formData, "next")));
    return { status: "success", message: "Senha alterada." };
  }

  const { error } = result;
  if (error.fields?.length) {
    return { status: "error", code: error.code, fields: Object.fromEntries(error.fields.map((f) => [f.field, fieldMessage("password", f.field, f.code)])) };
  }
  return {
    status: "error",
    code: error.code,
    message: error.message,
    ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    ...(error.redirectUrl ? { redirectUrl: error.redirectUrl } : {}),
  };
}
