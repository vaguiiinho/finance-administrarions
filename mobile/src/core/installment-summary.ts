import { formatBRL } from '@/lib/money/decimal';
import type { InstallmentPreview } from '@/lib/entries/installments';

/** "2 × R$ 58,34 e 4 × R$ 58,33" (ou "6 × R$ 50,00"): agrupa valores consecutivos iguais da previa. */
export function summarizeInstallments(preview: readonly InstallmentPreview[]): string {
  const groups: { amount: string; count: number }[] = [];
  for (const item of preview) {
    const last = groups[groups.length - 1];
    if (last && last.amount === item.amount) last.count += 1;
    else groups.push({ amount: item.amount, count: 1 });
  }
  return groups.map((g) => `${g.count} × ${formatBRL(g.amount)}`).join(' e ');
}
