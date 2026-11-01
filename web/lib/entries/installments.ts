import { fromCents, toCents } from "@/lib/money/decimal";

export interface InstallmentPreview {
  date: string;
  amount: string;
}

const MAX_AMOUNT_CENTS = 999_999_999_999n;

export function previewInstallments(total: string, count: number, firstDate: string): InstallmentPreview[] | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstDate);
  if (!dateMatch || !Number.isInteger(count) || count < 2 || count > 36) return null;
  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  if (year < 1900 || year > 9998 || month < 1 || month > 12 || day < 1) return null;
  const initialMaxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > initialMaxDay) return null;

  let totalCents: bigint;
  try {
    totalCents = toCents(total);
  } catch {
    return null;
  }
  if (totalCents <= 0n || totalCents > MAX_AMOUNT_CENTS || totalCents < BigInt(count)) return null;

  const baseCents = totalCents / BigInt(count);
  const remainder = totalCents % BigInt(count);
  const result: InstallmentPreview[] = [];
  for (let index = 0; index < count; index++) {
    const monthIndex = year * 12 + month - 1 + index;
    const installmentYear = Math.floor(monthIndex / 12);
    if (installmentYear > 9998) return null;
    const installmentMonth = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(installmentYear, installmentMonth, 0)).getUTCDate();
    const installmentDay = Math.min(day, lastDay);
    const date = `${String(installmentYear).padStart(4, "0")}-${String(installmentMonth).padStart(2, "0")}-${String(installmentDay).padStart(2, "0")}`;
    const amount = baseCents + (BigInt(index) < remainder ? 1n : 0n);
    result.push({ date, amount: fromCents(amount) });
  }
  return result;
}
