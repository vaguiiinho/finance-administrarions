/** Validacao de identificadores antes de interpolar em caminhos da API (evita path injection nas Server Actions). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
export const isYearMonthString = (value: unknown): value is string => typeof value === "string" && YEAR_MONTH_RE.test(value);

export function invalidInput(field: string): { ok: false; error: { status: 400; code: "VALIDATION_ERROR"; message: string; fields: { field: string; code: string; message: string }[] } } {
  return { ok: false, error: { status: 400, code: "VALIDATION_ERROR", message: "Dados inválidos.", fields: [{ field, code: "INVALID_FORMAT", message: "Valor em formato inválido." }] } };
}
