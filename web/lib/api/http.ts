import "server-only";
import type { ActionError, FieldIssue } from "./types";

/** `API_URL` so existe no servidor: o navegador nunca chama a API (ADR 9.2). */
const API_URL = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toActionError(): ActionError {
    const details = (this.details ?? {}) as {
      fields?: FieldIssue[];
      missingIds?: string[];
      incomeIds?: string[];
    };
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      ...(details.fields ? { fields: details.fields } : {}),
      ...(details.missingIds ? { missingIds: details.missingIds } : {}),
      ...(details.incomeIds ? { incomeIds: details.incomeIds } : {}),
    };
  }
}

export type Query = Record<string, string | undefined>;

async function request<T>(method: "GET" | "POST" | "PUT", path: string, options: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${API_URL}/api${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível falar com o servidor.", null);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string; message?: string; details?: unknown } | null;
    throw new ApiError(response.status, payload?.code ?? "INTERNAL_ERROR", payload?.message ?? "Erro inesperado.", payload?.details ?? null);
  }
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string, query?: Query) => request<T>("GET", path, { query });
export const apiPost = <T>(path: string, body?: unknown) => request<T>("POST", path, { body });
export const apiPut = <T>(path: string, body: unknown) => request<T>("PUT", path, { body });

/** Converte excecoes em `{ ok: false }` para Server Actions; erros desconhecidos viram 500. */
export async function toResult<T>(run: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: ActionError }> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.toActionError() };
    return { ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "Erro inesperado." } };
  }
}
