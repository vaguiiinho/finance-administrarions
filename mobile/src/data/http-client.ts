import { classifyApiError, type RawApiError } from '@/core/api-errors';

/** Erro serializavel do cliente HTTP. Interpretado so por `status`/`code` (RNF06). */
export class ApiError extends Error implements RawApiError {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly network?: boolean;
  readonly timeout?: boolean;

  constructor(init: RawApiError) {
    super(init.message ?? init.code ?? (init.timeout ? 'timeout' : init.network ? 'network' : 'api error'));
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.network = init.network;
    this.timeout = init.timeout;
  }
}

export interface UpdateRequiredDetails {
  minimumVersion?: string;
  storeUrl: string | null;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  clientVersion: string;
  timeoutMs?: number;
  onSessionExpired?: () => void;
  onUpdateRequired?: (details: UpdateRequiredDetails) => void;
  onPasswordChangeRequired?: () => void;
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** false = rota publica (login/logout): sem Bearer e sem tratar 401 como sessao expirada. */
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Token explicito (logout de uma sessao que nunca foi gravada). */
  token?: string;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiClient {
  get<T>(path: string, query?: RequestOptions['query'], options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return params ? `${url}?${params}` : url;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Cliente HTTP (ADR 0011 10.8): Bearer + `X-Client: mobile/<versao>`, timeout de 15 s por `AbortController`,
 * sem retry (mutacoes nunca reenviam) e tratamento global de 401 / 426 / 403 PASSWORD_CHANGE_REQUIRED.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, getToken, clientVersion, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  async function request<T>(method: string, path: string, req: RequestOptions = {}): Promise<T> {
    const useAuth = req.auth !== false;
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Client': `mobile/${clientVersion}` };
    const token = req.token ?? (useAuth ? getToken() : null);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, req.timeoutMs ?? timeoutMs);
    const onAbort = () => controller.abort();
    req.signal?.addEventListener('abort', onAbort);

    let response: Response;
    try {
      response = await fetch(buildUrl(baseUrl, path, req.query), {
        method,
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (timedOut) throw new ApiError({ timeout: true });
      if (req.signal?.aborted) throw cause;
      throw new ApiError({ network: true });
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', onAbort);
    }

    // Alguns ambientes respondem (5xx) a requisicao abortada em vez de rejeitar: o prazo estourado vale mais que a resposta.
    if (timedOut) throw new ApiError({ timeout: true });
    const payload = await readBody(response);
    if (response.ok) return payload as T;

    const body = (payload ?? {}) as { code?: string; message?: string; details?: unknown };
    const error = new ApiError({ status: response.status, code: body.code, message: body.message, details: body.details });
    const classified = classifyApiError(error);
    if (classified.kind === 'UPDATE_REQUIRED') {
      const details = (body.details ?? {}) as Partial<UpdateRequiredDetails>;
      options.onUpdateRequired?.({ minimumVersion: details.minimumVersion, storeUrl: details.storeUrl ?? null });
    } else if (classified.kind === 'PASSWORD_CHANGE_REQUIRED') {
      options.onPasswordChangeRequired?.();
    } else if (classified.kind === 'SESSION_EXPIRED' && useAuth) {
      options.onSessionExpired?.();
    }
    throw error;
  }

  return {
    get: (path, query, opts) => request('GET', path, { ...opts, query }),
    post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    delete: (path, opts) => request('DELETE', path, opts),
  };
}
