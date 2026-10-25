/**
 * Datas civis ("2026-11-05") e meses ("2026-11") sao tratados por string, sem fuso (ADR 9.4, CA23).
 * Instantes (UTC) sao exibidos em America/Sao_Paulo.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const MONTHS_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;

const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYearMonth(value: string): boolean {
  return YEAR_MONTH_RE.test(value);
}

function splitYearMonth(value: string): { year: number; month: number } {
  const m = YEAR_MONTH_RE.exec(value);
  if (!m) throw new RangeError(`mes invalido: ${JSON.stringify(value)}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** "2026-11" -> "nov/26" */
export function monthLabelPtBR(yearMonth: string): string {
  const { year, month } = splitYearMonth(yearMonth);
  return `${MONTHS_ABBR[month - 1]}/${String(year).slice(-2)}`;
}

/** "2026-11" -> "novembro de 2026" */
export function monthLongPtBR(yearMonth: string): string {
  const { year, month } = splitYearMonth(yearMonth);
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

/** "2026-11" + 1 -> "2026-12"; aceita deslocamentos negativos e viradas de ano. */
export function shiftMonth(yearMonth: string, delta: number): string {
  const { year, month } = splitYearMonth(yearMonth);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "2026-11-05" -> "05/11/2026" (split de string, sem Date). */
export function formatCivilDate(date: string): string {
  const m = CIVIL_DATE_RE.exec(date);
  if (!m) throw new RangeError(`data invalida: ${JSON.stringify(date)}`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function partsInSaoPaulo(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, hourCycle: "h23", ...options }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Instante ISO UTC -> "24/10/2026 às 10:00" em America/Sao_Paulo. */
export function formatInstant(iso: string): string {
  const p = partsInSaoPaulo(new Date(iso), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
}

/** Instante ISO UTC -> "24/10/2026" em America/Sao_Paulo. */
export function formatInstantDate(iso: string): string {
  const p = partsInSaoPaulo(new Date(iso), { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.day}/${p.month}/${p.year}`;
}

/** Mes corrente ("YYYY-MM") em America/Sao_Paulo (CA61). */
export function currentYearMonthSP(now: Date = new Date()): string {
  const p = partsInSaoPaulo(now, { year: "numeric", month: "2-digit" });
  return `${p.year}-${p.month}`;
}

/** Data de hoje ("YYYY-MM-DD") em America/Sao_Paulo. */
export function todaySP(now: Date = new Date()): string {
  const p = partsInSaoPaulo(now, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}
