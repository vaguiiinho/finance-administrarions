"use server";

import { toResult } from "@/lib/api/action-result";
import { createFinanceReader } from "@/lib/api/finance-reader";
import type { ActionResult, EntryDto } from "@/lib/api/types";
import { invalidInput, isUuid, isYearMonthString } from "@/lib/api/validate";

/** Unica action da demo: leitura, via reader demo, sem cookie (ADR 0005 9.5). */
export async function loadDemoInvoiceEntries(cardId: string, referenceMonth: string): Promise<ActionResult<{ items: EntryDto[] }>> {
  if (!isUuid(cardId)) return invalidInput("cardId");
  if (!isYearMonthString(referenceMonth)) return invalidInput("referenceMonth");
  return toResult(async () => {
    const { items } = await createFinanceReader("demo").listInvoiceEntries(cardId, referenceMonth);
    return { items };
  });
}
