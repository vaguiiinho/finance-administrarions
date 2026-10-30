import "server-only";
import { headers } from "next/headers";
import { readSessionToken } from "@/lib/auth/session-cookie";
import { apiBaseUrl } from "./api-url";


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
}

/** 401 (ADR 0005 9.2): sessao ausente, expirada ou encerrada. */
export class UnauthenticatedApiError extends ApiError {
  constructor(message = "Sua sessão expirou. Entre novamente.") {
    super(401, "UNAUTHENTICATED", message, null);
    this.name = "UnauthenticatedApiError";
  }
}
/** 403 `PASSWORD_CHANGE_REQUIRED`. */
export class PasswordChangeRequiredApiError extends ApiError {
  constructor(message = "É preciso trocar a senha.") {
    super(403, "PASSWORD_CHANGE_REQUIRED", message, null);
    this.name = "PasswordChangeRequiredApiError";
  }
}
/** 403 `FORBIDDEN`. */
export class ForbiddenApiError extends ApiError {
  constructor(message = "Sem permissão.") {
    super(403, "FORBIDDEN", message, null);
    this.name = "ForbiddenApiError";
  }
}

export type Query = Record<string, string | undefined>;

/** IP do cliente para o limite de tentativas da API (RNF04): repassa o `X-Forwarded-For` que chegou ao web. */
async function forwardedFor(): Promise<string | null> {
  try {
    return (await headers()).get("x-forwarded-for");
  } catch {
    return null; // fora de uma requisicao (build, testes)
  }
}

/**
 * `auth: "session"` (padrao) envia `Authorization: Bearer <cookie>`; sem cookie nem chama a API.
 * `auth: "none"` (login, rotas de demo) nunca envia o Bearer.
 */
export async function request<T>(method: "GET" | "POST" | "PUT", path: string, options: { query?: Query; body?: unknown; auth?: "session" | "none" } = {}): Promise<T> {
  const auth = options.auth ?? "session";
  const token = auth === "session" ? await readSessionToken() : undefined;
  if (auth === "session" && !token) throw new UnauthenticatedApiError();

  const url = new URL(`${apiBaseUrl()}/api${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const requestHeaders = new Headers();
  if (options.body !== undefined) requestHeaders.set("content-type", "application/json");
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  const xff = await forwardedFor();
  if (xff) requestHeaders.set("x-forwarded-for", xff);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      headers: requestHeaders,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível falar com o servidor.", null);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string; message?: string; details?: unknown } | null;
    const code = payload?.code ?? "INTERNAL_ERROR";
    const message = payload?.message ?? "Erro inesperado.";
    if (auth === "session" && response.status === 401) throw new UnauthenticatedApiError(message);
    if (response.status === 403 && code === "PASSWORD_CHANGE_REQUIRED") throw new PasswordChangeRequiredApiError(message);
    if (response.status === 403 && code === "FORBIDDEN") throw new ForbiddenApiError(message);
    throw new ApiError(response.status, code, message, payload?.details ?? null);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string, query?: Query) => request<T>("GET", path, { query });
export const apiPost = <T>(path: string, body?: unknown) => request<T>("POST", path, { body });
export const apiPut = <T>(path: string, body: unknown) => request<T>("PUT", path, { body });
