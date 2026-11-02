import { monthLabelPtBR } from "@/lib/dates/format";
import { formatBRL } from "@/lib/money/decimal";
import type { InvoiceDto } from "@/lib/api/types";

/** Toast do pagamento da fatura com os valores da RESPOSTA (P21). */
export function invoicePaidFeedback(
  invoice: Pick<InvoiceDto, "card" | "referenceMonth" | "totals">,
  result: { paidCount: number; paidAmount: string },
): string {
  if (result.paidCount === 0) return "Nenhuma despesa pendente nesta fatura. Nada foi alterado.";
  const noun = result.paidCount === 1 ? "despesa" : "despesas";
  const base = `Fatura ${invoice.card.name} de ${monthLabelPtBR(invoice.referenceMonth)} paga: ${result.paidCount} ${noun}, ${formatBRL(result.paidAmount)}.`;
  return result.paidAmount !== invoice.totals.pending ? `${base} O valor difere do exibido porque a fatura mudou.` : base;
}

/** Toast do pagamento individual / em lote. */
export function paidFeedback(result: { paidCount: number; alreadyPaidCount: number }, singleDescription?: string): string {
  if (singleDescription && result.paidCount === 1) return `"${singleDescription}" marcado como pago.`;
  const noun = (n: number) => (n === 1 ? "despesa" : "despesas");
  const paid = `${result.paidCount} ${noun(result.paidCount)} ${result.paidCount === 1 ? "marcada" : "marcadas"} como ${result.paidCount === 1 ? "paga" : "pagas"}.`;
  return result.alreadyPaidCount > 0 ? `${paid} ${result.alreadyPaidCount} já ${result.alreadyPaidCount === 1 ? "estava paga" : "estavam pagas"}.` : paid;
}

/** Contagens em pt-BR com plural explicito. */
export const countLabel = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
