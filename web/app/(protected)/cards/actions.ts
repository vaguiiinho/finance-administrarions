"use server";

import { revalidatePath } from "next/cache";
import { toResult } from "@/lib/api/action-result";
import { createCardRequest, updateCardRequest } from "@/lib/api/endpoints";
import { invalidInput, isUuid } from "@/lib/api/validate";
import type { ActionResult, CardDto, CardPayload } from "@/lib/api/types";

function revalidateCards() {
  revalidatePath("/cards");
  revalidatePath("/entries");
}

/** Tambem usada pelo atalho "+ Novo cartao" do drawer de lancamento (RF23, CA75). */
export async function createCard(payload: CardPayload): Promise<ActionResult<CardDto>> {
  const result = await toResult(() => createCardRequest(payload));
  if (result.ok) revalidateCards();
  return result;
}

export async function updateCard(id: string, payload: CardPayload): Promise<ActionResult<CardDto>> {
  if (!isUuid(id)) return invalidInput("id");
  const result = await toResult(() => updateCardRequest(id, payload));
  if (result.ok) revalidateCards();
  return result;
}
