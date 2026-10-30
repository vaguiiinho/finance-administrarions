"use server";

import { revalidatePath } from "next/cache";
import { toResult } from "@/lib/api/action-result";
import { createEntryRequest, listInvoiceEntries, payEntriesRequest, payEntryRequest, payInvoiceRequest } from "@/lib/api/endpoints";
import { invalidInput, isUuid, isYearMonthString } from "@/lib/api/validate";
import type { ActionResult, CreateEntryPayload, EntryDto, PayEntriesResult, PayInvoiceResult } from "@/lib/api/types";

/** Uma mutacao re-renderiza resumo, subtotal, faturas e listas juntos (R16, CA51, CA70, CA72). */
function revalidateEntries() {
  revalidatePath("/entries");
  revalidatePath("/dashboard");
}

export async function createEntry(payload: CreateEntryPayload): Promise<ActionResult<EntryDto>> {
  const result = await toResult(() => createEntryRequest(payload));
  if (result.ok) revalidateEntries();
  return result;
}

export async function payEntry(id: string): Promise<ActionResult<EntryDto>> {
  if (!isUuid(id)) return invalidInput("id");
  const result = await toResult(() => payEntryRequest(id));
  // 404/422 tambem atualizam a tela: a lista pode estar obsoleta
  revalidateEntries();
  return result;
}

export async function payEntries(ids: string[]): Promise<ActionResult<PayEntriesResult>> {
  if (!Array.isArray(ids) || !ids.every(isUuid)) return invalidInput("ids");
  const result = await toResult(() => payEntriesRequest(ids));
  revalidateEntries();
  return result;
}

export async function payInvoice(cardId: string, referenceMonth: string): Promise<ActionResult<PayInvoiceResult>> {
  if (!isUuid(cardId)) return invalidInput("cardId");
  if (!isYearMonthString(referenceMonth)) return invalidInput("referenceMonth");
  const result = await toResult(() => payInvoiceRequest(cardId, referenceMonth));
  revalidateEntries();
  return result;
}

/** Leitura sob demanda (I2) da lista de uma fatura; resultado fica no estado do bloco (ADR 9.2). */
export async function loadInvoiceEntries(cardId: string, referenceMonth: string): Promise<ActionResult<EntryDto[]>> {
  if (!isUuid(cardId)) return invalidInput("cardId");
  if (!isYearMonthString(referenceMonth)) return invalidInput("referenceMonth");
  return toResult(async () => (await listInvoiceEntries(cardId, referenceMonth)).items);
}
