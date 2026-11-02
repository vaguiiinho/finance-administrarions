import { renderRouter } from 'expo-router/testing-library';
import { http, HttpResponse } from 'msw';
import { server, API, ME } from './server';
import { keychain } from './setup';

type Handler = Parameters<typeof server.use>[0];
export const json = (body: unknown, status = 200) => HttpResponse.json(body as never, { status });
export const apiError = (status: number, code: string, details: unknown = {}) => HttpResponse.json({ code, message: 'texto qualquer', details } as never, { status });
export const get = (path: string, resolver: () => Response) => http.get(`${API}${path}`, resolver);
export const post = (path: string, resolver: () => Response) => http.post(`${API}${path}`, resolver);

export const futureSession = () => JSON.stringify({ token: 'tok-abc', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
/** Sessao ja gravada no Keychain + `me` valido. */
export function signedIn(me: object = ME, ...handlers: Handler[]) {
  keychain.set('fa.session', futureSession());
  server.use(get('/api/auth/me', () => json(me)), ...handlers);
}
/** Renderiza o app REAL pelo Expo Router (rotas de ADR 0011 10.2): sem adivinhar nomes de componentes. */
export const renderApp = (initialUrl = '/') => renderRouter('./app', { initialUrl });
