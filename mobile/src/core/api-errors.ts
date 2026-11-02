import type { FieldIssue } from '@/lib/api/types';

/** Erro bruto devolvido pelo cliente HTTP (data layer). */
export interface RawApiError {
  status?: number;
  code?: string;
  message?: string;
  details?: unknown;
  network?: boolean;
  timeout?: boolean;
}

export type ApiErrorKind =
  | 'SESSION_EXPIRED'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'FORBIDDEN'
  | 'UPDATE_REQUIRED'
  | 'RATE_LIMITED'
  | 'INVALID_CREDENTIALS'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNPROCESSABLE'
  | 'CONFLICT'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER';

export interface ClassifiedError {
  kind: ApiErrorKind;
  code?: string;
  status?: number;
  retryAfterMinutes?: number;
  fields?: FieldIssue[];
  missingIds?: string[];
  incomeIds?: string[];
  details?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** Mapeamento SEMPRE por `status`/`code`, nunca pelo texto de `message` (RNF06). */
export function classifyApiError(error: RawApiError): ClassifiedError {
  if (error.timeout) return { kind: 'TIMEOUT' };
  if (error.network) return { kind: 'NETWORK' };
  const { status = 0, code } = error;
  const details = asRecord(error.details);
  const base = { code, status, details: error.details };

  if (status === 426 || code === 'APP_UPDATE_REQUIRED') return { ...base, kind: 'UPDATE_REQUIRED' };
  if (code === 'PASSWORD_CHANGE_REQUIRED') return { ...base, kind: 'PASSWORD_CHANGE_REQUIRED' };
  if (code === 'INVALID_CREDENTIALS') return { ...base, kind: 'INVALID_CREDENTIALS' };
  if (status === 401) return { ...base, kind: 'SESSION_EXPIRED' };
  if (status === 403) return { ...base, kind: 'FORBIDDEN' };
  if (status === 429) {
    const seconds = typeof details.retryAfterSeconds === 'number' ? details.retryAfterSeconds : 60;
    return { ...base, kind: 'RATE_LIMITED', retryAfterMinutes: Math.max(1, Math.ceil(seconds / 60)) };
  }
  if (status === 400) {
    const fields = Array.isArray(details.fields) ? (details.fields as FieldIssue[]) : [];
    return { ...base, kind: 'VALIDATION', fields };
  }
  if (status === 404) {
    const missingIds = Array.isArray(details.missingIds) ? (details.missingIds as string[]) : undefined;
    return { ...base, kind: 'NOT_FOUND', missingIds };
  }
  if (status === 409) return { ...base, kind: 'CONFLICT' };
  if (status === 422) {
    const incomeIds = Array.isArray(details.incomeIds) ? (details.incomeIds as string[]) : undefined;
    return { ...base, kind: 'UNPROCESSABLE', incomeIds };
  }
  return { ...base, kind: 'SERVER' };
}

/** Mensagens de campo (pt-BR) por `code` do 400; o `message` da API, quando existe, tem prioridade. */
const FIELD_CODE_MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  TOO_LONG: 'Texto longo demais. Máximo de caracteres excedido.',
  TOO_SHORT: 'Texto curto demais.',
  INVALID_FORMAT: 'Formato inválido.',
  INVALID_VALUE: 'Valor inválido.',
  INVALID_DATE: 'Informe uma data válida.',
  OUT_OF_RANGE: 'Valor fora do intervalo permitido.',
  TOO_MANY_DECIMALS: 'Use no máximo 2 casas decimais.',
  MUST_BE_POSITIVE: 'Informe um valor maior que zero.',
  TOO_LARGE: 'O valor é grande demais.',
  INCORRECT: 'Senha atual incorreta.',
  SAME_AS_CURRENT: 'A nova senha deve ser diferente da atual.',
};

export function fieldIssueMessage(issue: Pick<FieldIssue, 'code'> & { message?: string }): string {
  return issue.message || FIELD_CODE_MESSAGES[issue.code] || 'Valor inválido.';
}

/** Garante `message` em cada issue antes de `mapApiFieldIssues` (que usa o texto da API). */
export function withFieldMessages(issues: readonly FieldIssue[] | undefined): FieldIssue[] {
  return (issues ?? []).map((issue) => ({ ...issue, message: fieldIssueMessage(issue) }));
}
