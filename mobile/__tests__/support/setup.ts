import './serialize-user-event';
import { server, calls } from './server';

// Keychain em memoria (o teste inspeciona o que foi gravado: CA01, RNF02).
const mockKeychain = new Map<string, string>();
export const keychain = mockKeychain;
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockKeychain.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockKeychain.delete(k)),
}));
const mockAsync = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => {
  const api = {
    getItem: async (k: string) => mockAsync.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockAsync.set(k, v),
    removeItem: async (k: string) => void mockAsync.delete(k),
    getAllKeys: async () => [...mockAsync.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, mockAsync.get(k) ?? null]),
    clear: async () => mockAsync.clear(),
  };
  return { __esModule: true, default: api, ...api };
});
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3' }));

process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.test';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  // Dois userEvent.press concorrentes (Promise.all, CA27) deixam o RNTL com IS_REACT_ACT_ENVIRONMENT=false para os
  // testes seguintes do arquivo: restaura antes de cada teste.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  keychain.clear();
  mockAsync.clear();
  calls.length = 0;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
server.events.on('request:start', async ({ request }) => {
  const clone = request.clone();
  const text = await clone.text().catch(() => '');
  calls.push({
    method: request.method,
    path: new URL(request.url).pathname + new URL(request.url).search,
    body: text ? JSON.parse(text) : undefined,
    headers: Object.fromEntries(request.headers.entries()),
  });
});
