"use server";

import { revalidatePath } from "next/cache";
import { toResult } from "@/lib/api/action-result";
import { createUser, deactivateUser, reactivateUser, resetUserPassword, updateUser } from "@/lib/api/identity-client";
import { invalidInput, isUuid } from "@/lib/api/validate";
import type { ActionResult, AdminUserDto } from "@/lib/api/types";
import { getCurrentUser } from "@/lib/auth/current-user";

/** `selfDemoted`: o alvo era o proprio ator e o nivel passou a USER (PA7: levar para `/entries`). */
export interface UpdateUserData {
  user: AdminUserDto;
  selfDemoted: boolean;
}

const refreshList = () => revalidatePath("/admin/users");

/** A senha temporaria so vai a API: nunca volta no resultado. */
export async function createUserAction(input: { name: string; email: string; role: string; password: string }): Promise<ActionResult<AdminUserDto>> {
  const result = await toResult(() => createUser(input));
  if (result.ok) refreshList();
  return result;
}

export async function updateUserAction(id: string, input: { name: string; email: string; role: string }): Promise<ActionResult<UpdateUserData>> {
  if (!isUuid(id)) return invalidInput("id");
  const result = await toResult(async () => {
    // o ator e lido do servidor, ANTES da escrita (nunca do cliente): so administradores chegam aqui
    const actor = await getCurrentUser().catch(() => null);
    const user = await updateUser(id, input);
    return { user, selfDemoted: actor?.id === id && user.role === "USER" };
  });
  if (result.ok) {
    if (result.data.selfDemoted) revalidatePath("/", "layout");
    else refreshList();
  }
  return result;
}

export async function deactivateUserAction(id: string): Promise<ActionResult<AdminUserDto>> {
  if (!isUuid(id)) return invalidInput("id");
  const result = await toResult(() => deactivateUser(id));
  if (result.ok) refreshList();
  return result;
}

export async function reactivateUserAction(id: string): Promise<ActionResult<AdminUserDto>> {
  if (!isUuid(id)) return invalidInput("id");
  const result = await toResult(() => reactivateUser(id));
  if (result.ok) refreshList();
  return result;
}

export async function resetUserPasswordAction(id: string, input: { password: string }): Promise<ActionResult<AdminUserDto>> {
  if (!isUuid(id)) return invalidInput("id");
  const result = await toResult(() => resetUserPassword(id, input.password));
  if (result.ok) refreshList();
  return result;
}
