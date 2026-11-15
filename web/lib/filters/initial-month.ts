import { currentYearMonthSP, isYearMonth } from "@/lib/dates/format";
import type { RawSearchParams } from "@/lib/filters/entries-search-params";

/**
 * Mes inicial da tela de lancamentos (ADR 0007 7.2/7.3). Modulo puro: a REGRA mora na API; aqui so ha a montagem de
 * URLs e a validacao do sinal de aviso (`adv`, `adv_from`), que nunca entra em `EntriesState`.
 */
export type MonthAdvance = "NONE" | "NEXT_PENDING" | "NO_PENDING_AHEAD";
export interface InitialMonthDecision {
  currentMonth: string;
  month: string;
  advance: MonthAdvance;
}
export interface AdvanceSignal {
  advance: Exclude<MonthAdvance, "NONE">;
  /** adv_from: o mes (M) em que nao havia pendencia */
  from: string;
}

const ADVANCES: readonly AdvanceSignal["advance"][] = ["NEXT_PENDING", "NO_PENDING_AHEAD"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** O parametro `month` esta presente na URL (valido ou nao)? Se sim, a regra do mes inicial nunca roda (RF06, RF08). */
export function hasMonthParam(raw: RawSearchParams): boolean {
  return first(raw.month) !== undefined;
}

function hrefWith(raw: RawSearchParams, month: string, signal: AdvanceSignal | null): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (key === "month" || key === "adv" || key === "adv_from") continue;
    const v = first(value);
    if (v !== undefined) q.set(key, v);
  }
  q.set("month", month);
  if (signal) {
    q.set("adv", signal.advance);
    q.set("adv_from", signal.from);
  }
  return `/entries?${q.toString()}`;
}

/** URL de redirecionamento com o mes resolvido; mantem os demais parametros e acrescenta adv/adv_from se houve avanco. */
export function initialMonthHref(raw: RawSearchParams, decision: InitialMonthDecision): string {
  const signal = decision.advance === "NONE" ? null : { advance: decision.advance, from: decision.currentMonth };
  return hrefWith(raw, decision.month, signal);
}

/** URL de redirecionamento quando a verificacao falha: `month=<M do web>`, sem aviso (RNF02). */
export function fallbackMonthHref(raw: RawSearchParams, now: Date): string {
  return hrefWith(raw, currentYearMonthSP(now), null);
}

/** Le e valida o sinal de aviso da URL; invalido -> null (ignorado sem erro). `YYYY-MM` compara como texto. */
export function parseAdvanceSignal(raw: RawSearchParams, month: string): AdvanceSignal | null {
  const advance = first(raw.adv);
  const from = first(raw.adv_from);
  if (!ADVANCES.includes(advance as AdvanceSignal["advance"])) return null;
  if (from === undefined || !isYearMonth(from) || from >= month) return null;
  return { advance: advance as AdvanceSignal["advance"], from };
}

/** Remove adv/adv_from de uma query string/URL (consumo do sinal pelo cliente). */
export function stripAdvanceSignal(href: string): string {
  const [path, query = ""] = href.split("?");
  const kept = query.split("&").filter((pair) => pair && !/^(adv|adv_from)=/.test(pair));
  return kept.length ? `${path}?${kept.join("&")}` : path;
}
