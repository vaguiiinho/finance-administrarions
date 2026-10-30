"use server";

import { revalidatePath } from "next/cache";
import { toResult } from "@/lib/api/action-result";
import { updateProfile } from "@/lib/api/identity-client";
import { fieldMessage } from "@/lib/auth/field-messages";
import type { FormState } from "@/lib/auth/form-state";

/** A5. Campo: `name`. Sucesso devolve `values.name` normalizado pela API e revalida o layout (inicial da navbar, CA11). */
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw : "";
  const result = await toResult(() => updateProfile(name));
  if (result.ok) {
    revalidatePath("/", "layout");
    return { status: "success", message: "Perfil atualizado.", values: { name: result.data.name } };
  }
  const { error } = result;
  if (error.fields?.length) {
    return { status: "error", code: error.code, fields: Object.fromEntries(error.fields.map((f) => [f.field, fieldMessage("profile", f.field, f.code)])), values: { name } };
  }
  return { status: "error", code: error.code, message: error.message, ...(error.redirectUrl ? { redirectUrl: error.redirectUrl } : {}), values: { name } };
}
