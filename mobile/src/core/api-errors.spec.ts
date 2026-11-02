import { classifyApiError } from '@/core/api-errors';

const c = (status: number, code?: string, extra: object = {}) => classifyApiError({ status, code, ...extra } as never);

describe('mapeamento de erros por code, nunca por message (RNF06)', () => {
  it('401 -> SESSION_EXPIRED', () => expect(c(401, 'UNAUTHENTICATED').kind).toBe('SESSION_EXPIRED'));
  it('403 PASSWORD_CHANGE_REQUIRED', () => expect(c(403, 'PASSWORD_CHANGE_REQUIRED').kind).toBe('PASSWORD_CHANGE_REQUIRED'));
  it('403 FORBIDDEN', () => expect(c(403, 'FORBIDDEN').kind).toBe('FORBIDDEN'));
  it('426 APP_UPDATE_REQUIRED', () => expect(c(426, 'APP_UPDATE_REQUIRED').kind).toBe('UPDATE_REQUIRED'));
  it('429 com retryAfterSeconds -> minutos arredondados para cima', () => {
    const r = c(429, 'TOO_MANY_ATTEMPTS', { details: { retryAfterSeconds: 61 } });
    expect(r).toMatchObject({ kind: 'RATE_LIMITED', retryAfterMinutes: 2 });
  });
  it('404 e 422 mantem o code', () => {
    expect(c(404, 'ENTRY_NOT_FOUND')).toMatchObject({ kind: 'NOT_FOUND', code: 'ENTRY_NOT_FOUND' });
    expect(c(422, 'PAID_CARD_EXPENSE_DATE_LOCKED')).toMatchObject({ kind: 'UNPROCESSABLE', code: 'PAID_CARD_EXPENSE_DATE_LOCKED' });
  });
  it('rede e timeout', () => {
    expect(classifyApiError({ network: true } as never).kind).toBe('NETWORK');
    expect(classifyApiError({ timeout: true } as never).kind).toBe('TIMEOUT');
  });
  it('5xx -> SERVER; o texto de message e ignorado', () => expect(c(500, 'INTERNAL_ERROR', { message: 'Sessão expirada' }).kind).toBe('SERVER'));
});
