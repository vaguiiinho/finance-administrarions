import { formatBRL } from "@/lib/money/decimal";
import { formatCivilDate, monthLabelPtBR } from "@/lib/dates/format";

/** Valor monetario a partir da string decimal; nunca trunca (quebra so depois de "R$"). */
export function Money({ value, className = "" }: { value: string; className?: string }) {
  return <span className={`money whitespace-nowrap ${className}`.trim()}>{formatBRL(value)}</span>;
}

export function CivilDate({ value }: { value: string }) {
  return <time dateTime={value}>{formatCivilDate(value)}</time>;
}

export function MonthLabel({ value }: { value: string }) {
  return <time dateTime={value}>{monthLabelPtBR(value)}</time>;
}
