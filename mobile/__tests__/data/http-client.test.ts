import { server, API, callsTo } from '../support/server';
import { http, HttpResponse } from 'msw';
import { createApiClient } from '@/data/http-client';

/** CONTRATO ASSUMIDO: createApiClient({ baseUrl, getToken, clientVersion, onSessionExpired, onUpdateRequired, onPasswordChangeRequired }). */
const make = (over: object = {}) => {
  const hooks = { onSessionExpired: jest.fn(), onUpdateRequired: jest.fn(), onPasswordChangeRequired: jest.fn() };
  const client = createApiClient({ baseUrl: API, getToken: () => 'tok-abc', clientVersion: '1.2.3', timeoutMs: 15_000, ...hooks, ...over } as never);
  return { client, ...hooks };
};

describe('cliente HTTP (ADR 0011 10.8)', () => {
  it('envia Authorization Bearer e X-Client mobile/<versao>', async () => {
    server.use(http.get(`${API}/api/auth/me`, () => HttpResponse.json({})));
    await make().client.get('/api/auth/me');
    const h = callsTo('GET', '/api/auth/me')[0].headers;
    expect(h.authorization).toBe('Bearer tok-abc');
    expect(h['x-client']).toBe('mobile/1.2.3');
  });
  it('401 dispara onSessionExpired e nao tenta renovar', async () => {
    server.use(http.get(`${API}/api/summary`, () => HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'm', details: null }, { status: 401 })));
    const { client, onSessionExpired } = make();
    await expect(client.get('/api/summary')).rejects.toBeDefined();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
  it('426 dispara onUpdateRequired com details', async () => {
    server.use(http.get(`${API}/api/summary`, () => HttpResponse.json({ code: 'APP_UPDATE_REQUIRED', message: 'm', details: { minimumVersion: '1.2.0', storeUrl: null } }, { status: 426 })));
    const { client, onUpdateRequired } = make();
    await expect(client.get('/api/summary')).rejects.toBeDefined();
    expect(onUpdateRequired).toHaveBeenCalledWith({ minimumVersion: '1.2.0', storeUrl: null });
  });
  it('403 PASSWORD_CHANGE_REQUIRED dispara onPasswordChangeRequired', async () => {
    server.use(http.get(`${API}/api/summary`, () => HttpResponse.json({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'm', details: {} }, { status: 403 })));
    const { client, onPasswordChangeRequired } = make();
    await expect(client.get('/api/summary')).rejects.toBeDefined();
    expect(onPasswordChangeRequired).toHaveBeenCalled();
  });
  it('mutacao nunca tem retry automatico (5xx -> 1 chamada)', async () => {
    server.use(http.post(`${API}/api/entries`, () => HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'm', details: null }, { status: 500 })));
    await expect(make().client.post('/api/entries', {})).rejects.toBeDefined();
    expect(callsTo('POST', '/api/entries')).toHaveLength(1);
  });
  it('timeout de 15 s: aborta e classifica como TIMEOUT, sem reenviar escrita', async () => {
    jest.useFakeTimers();
    server.use(http.post(`${API}/api/entries`, async () => { await new Promise(() => undefined); return HttpResponse.json({}); }));
    const p = make().client.post('/api/entries', {});
    const assertion = expect(p).rejects.toMatchObject({ timeout: true });
    await jest.advanceTimersByTimeAsync(15_001);
    await assertion;
    jest.useRealTimers();
  });
});
