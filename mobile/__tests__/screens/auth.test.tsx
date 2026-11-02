import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { server, calls, callsTo, ME, DEMO_ME, SUMMARY } from '../support/server';
import { keychain } from '../support/setup';
import { apiError, get, json, post, renderApp, signedIn } from '../support/render-app';

const login = async (email: string, password: string) => {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.press(screen.getByRole('button', { name: 'Entrar' }));
};
const AUTH = (user: object) => json({ user, session: { token: 'tok-abc', expiresAt: new Date(Date.now() + 86_400_000).toISOString() } });

describe('login (RF01, CA01-CA03)', () => {
  it('CA01: sucesso grava o token so no Keychain, envia X-Client e abre o Dashboard', async () => {
    server.use(post('/api/auth/login', () => AUTH(ME)), get('/api/summary', () => json(SUMMARY)));
    renderApp('/login');
    await login('ana@exemplo.com', 'segredo123');
    expect(await screen.findByText('Dashboard')).toBeOnTheScreen();
    expect(callsTo('POST', '/api/auth/login')[0].headers['x-client']).toBe('mobile/1.2.3');
    expect(keychain.get('fa.session')).toContain('tok-abc');
    expect(JSON.stringify(await require('@react-native-async-storage/async-storage').getAllKeys())).not.toContain('tok-abc');
  });

  it('a conta demo entra com demo@showcase.invalid / demo (sem excecao de formato)', async () => {
    server.use(post('/api/auth/login', () => AUTH(DEMO_ME)));
    renderApp('/login');
    await login('demo@showcase.invalid', 'demo');
    await waitFor(() => expect(callsTo('POST', '/api/auth/login')[0].body).toEqual({ email: 'demo@showcase.invalid', password: 'demo' }));
  });

  it('CA02: INVALID_CREDENTIALS mostra o banner generico e nao grava token', async () => {
    server.use(post('/api/auth/login', () => apiError(401, 'INVALID_CREDENTIALS')));
    renderApp('/login');
    await login('ana@exemplo.com', 'errada');
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeOnTheScreen();
    expect(keychain.size).toBe(0);
  });

  it('CA03: 429 mostra o tempo em minutos a partir de retryAfterSeconds', async () => {
    server.use(post('/api/auth/login', () => apiError(429, 'TOO_MANY_ATTEMPTS', { retryAfterSeconds: 600 })));
    renderApp('/login');
    await login('ana@exemplo.com', 'x');
    expect(await screen.findByText(/Muitas tentativas\. Tente novamente em 10 min\./)).toBeOnTheScreen();
  });

  it('resposta malformada do login: mensagem generica e nenhuma sessao gravada', async () => {
    server.use(post('/api/auth/login', () => json({ user: ME, session: { token: '', expiresAt: 'x' } })));
    renderApp('/login');
    await login('ana@exemplo.com', 'segredo123');
    expect(await screen.findByText('Algo deu errado. Tente novamente.')).toBeOnTheScreen();
    expect(keychain.size).toBe(0);
  });

  it('envio duplo: dois toques em Entrar enviam uma unica requisicao', async () => {
    server.use(post('/api/auth/login', () => AUTH(ME)));
    renderApp('/login');
    await login('ana@exemplo.com', 'segredo123');
    await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }));
    expect(callsTo('POST', '/api/auth/login')).toHaveLength(1);
  });

  it('nao existe "Criar conta"; ha o texto de acesso por administrador', async () => {
    renderApp('/login');
    expect(await screen.findByText(/Fale com um administrador/)).toBeOnTheScreen();
    expect(screen.queryByText(/Criar conta/i)).toBeNull();
  });
});

describe('401 volta ao login (RF04, CA05)', () => {
  it('qualquer 401 apaga o token, mostra a mensagem e nao tenta renovar', async () => {
    signedIn(ME, get('/api/summary', () => apiError(401, 'UNAUTHENTICATED')));
    renderApp('/');
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeOnTheScreen();
    expect(keychain.has('fa.session')).toBe(false);
    expect(calls.some((c) => /refresh/.test(c.path))).toBe(false);
  });

  it('sessao expirada localmente: nem chama a API', async () => {
    keychain.set('fa.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() - 1000).toISOString() }));
    renderApp('/');
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeOnTheScreen();
    expect(calls).toHaveLength(0);
  });
});

describe('boot (RF02, CA04, CA06)', () => {
  it('CA04: token valido -> GET /api/auth/me e Dashboard, sem pedir senha', async () => {
    signedIn();
    server.use(get('/api/summary', () => json(SUMMARY)));
    renderApp('/');
    expect(await screen.findByText('Dashboard')).toBeOnTheScreen();
    expect(callsTo('GET', '/api/auth/me')).toHaveLength(1);
  });
  it('CA06: sem rede mostra "Tentar novamente" e NAO apaga o token', async () => {
    keychain.set('fa.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 1e6).toISOString() }));
    server.use(get('/api/auth/me', () => Response.error()));
    renderApp('/');
    expect(await screen.findByText('Sem conexão. Verifique sua internet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
    expect(keychain.has('fa.session')).toBe(true);
  });
});

describe('boot com falha que nao e de rede (S-4)', () => {
  const stored = () => keychain.set('fa.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 1e6).toISOString() }));

  it('resposta invalida do me: texto generico (nao "sem conexao"), com Tentar novamente e token mantido', async () => {
    stored();
    server.use(get('/api/auth/me', () => json({ user: ME })));
    renderApp('/');
    expect(await screen.findByText('Não foi possível carregar. Tente novamente.')).toBeOnTheScreen();
    expect(screen.queryByText('Sem conexão. Verifique sua internet.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
    expect(keychain.has('fa.session')).toBe(true);
  });

  it.each([[429, 'TOO_MANY_ATTEMPTS'], [403, 'FORBIDDEN']])('%s no me nao deixa o app preso na abertura', async (status, code) => {
    stored();
    server.use(get('/api/auth/me', () => apiError(status, code)));
    renderApp('/');
    expect(await screen.findByText('Não foi possível carregar. Tente novamente.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
  });
});

describe('426 APP_UPDATE_REQUIRED (T7)', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });
  afterEach(() => openURL.mockRestore());

  it('mostra a tela de atualizar, mantem o token e "Atualizar" abre a storeUrl', async () => {
    signedIn(ME, get('/api/summary', () => apiError(426, 'APP_UPDATE_REQUIRED', { minimumVersion: '1.2.0', storeUrl: 'https://apps.apple.com/app/id1' })));
    renderApp('/');
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Atualizar' }));
    expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id1');
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(keychain.has('fa.session')).toBe(true);
  });

  it('S7: storeUrl fora da App Store segue pelo navegador do sistema', async () => {
    signedIn(ME, get('/api/summary', () => apiError(426, 'APP_UPDATE_REQUIRED', { minimumVersion: '1.2.0', storeUrl: 'https://example.com/baixar' })));
    renderApp('/');
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Atualizar' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com/baixar');
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('troca obrigatoria pendente (RF32, CA07, CA08, P-ADR1 variante A)', () => {
  const NOTICE = 'Você precisa definir uma nova senha antes do primeiro acesso. Troque a senha pelo site e depois entre no app com a nova senha.';
  const carla = { ...ME, name: 'Carla', mustChangePassword: true };

  it('CA07: login com mustChangePassword chama logout, NAO grava token, mostra o aviso e "Abrir o site"', async () => {
    server.use(post('/api/auth/login', () => AUTH(carla)), post('/api/auth/logout', () => new Response(null, { status: 204 })));
    renderApp('/login');
    await login('carla@exemplo.com', 'Temp1234');
    expect(await screen.findByText(NOTICE)).toBeOnTheScreen();
    await waitFor(() => expect(callsTo('POST', '/api/auth/logout')).toHaveLength(1));
    expect(keychain.has('fa.session')).toBe(false);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Abrir o site' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/app\.test\/login/));
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('CA08: me com mustChangePassword no boot -> logout, token apagado, aviso', async () => {
    signedIn(carla, post('/api/auth/logout', () => new Response(null, { status: 204 })));
    renderApp('/');
    expect(await screen.findByText(NOTICE)).toBeOnTheScreen();
    expect(keychain.has('fa.session')).toBe(false);
    expect(callsTo('POST', '/api/auth/logout')).toHaveLength(1);
  });

  it('CA08: 403 PASSWORD_CHANGE_REQUIRED em qualquer leitura leva ao mesmo aviso', async () => {
    signedIn(ME, get('/api/summary', () => apiError(403, 'PASSWORD_CHANGE_REQUIRED')), post('/api/auth/logout', () => new Response(null, { status: 204 })));
    renderApp('/');
    expect(await screen.findByText(NOTICE)).toBeOnTheScreen();
  });

  it('a falha do logout (rede) e ignorada: o aviso aparece mesmo assim', async () => {
    server.use(post('/api/auth/login', () => AUTH(carla)), post('/api/auth/logout', () => Response.error()));
    renderApp('/login');
    await login('carla@exemplo.com', 'Temp1234');
    expect(await screen.findByText(NOTICE)).toBeOnTheScreen();
  });
});

describe('Ajustes (RF05, RF23, RF33, B8, CA09, CA48)', () => {
  it('Sair chama logout, apaga o token e volta ao login; sem rede sai igual', async () => {
    signedIn(ME, post('/api/auth/logout', () => Response.error()), get('/api/summary', () => json(SUMMARY)));
    renderApp('/settings');
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeOnTheScreen();
    expect(keychain.has('fa.session')).toBe(false);
  });

  it('usuario comum ve "Trocar senha"', async () => {
    signedIn();
    renderApp('/settings');
    expect(await screen.findByText('Trocar senha')).toBeOnTheScreen();
  });

  // Design rev. 3 (B8, decisao do usuario): o item fica VISIVEL e DESABILITADO, com o motivo; nao e ocultado.
  it('conta demo (accountKind SHOWCASE, sem CHANGE_OWN_PASSWORD): o item aparece desabilitado com o motivo e ha o aviso da limpeza as 03:00', async () => {
    signedIn(DEMO_ME);
    renderApp('/settings');
    expect(await screen.findByText('demo@showcase.invalid')).toBeOnTheScreen();
    expect(screen.getByText('Trocar senha')).toBeOnTheScreen();
    expect(screen.getByText('Trocar senha')).toBeDisabled();
    expect(screen.getByText('Indisponível na conta de demonstração')).toBeOnTheScreen();
    expect(screen.getByText(/03:00/)).toBeOnTheScreen();
  });

  it('S2: conta nao demo sem CHANGE_OWN_PASSWORD ve o texto generico, nao o de demonstracao', async () => {
    signedIn({ ...ME, capabilities: ['MANAGE_EXPENSES'] });
    renderApp('/settings');
    expect(await screen.findByText('Indisponível para esta conta')).toBeOnTheScreen();
    expect(screen.queryByText('Indisponível na conta de demonstração')).toBeNull();
  });

  it('REGULAR sem o aviso de demo, mesmo com e-mail demo@showcase.invalid (nunca compara e-mail)', async () => {
    signedIn({ ...ME, email: 'demo@showcase.invalid' });
    renderApp('/settings');
    await screen.findByText('demo@showcase.invalid');
    expect(screen.queryByText(/03:00/)).toBeNull();
  });

  it('troca de senha: confirmacao diferente nao chama a API; sucesso mantem a sessao e avisa das outras', async () => {
    signedIn();
    server.use(http_put_ok());
    renderApp('/settings/change-password');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Senha atual'), 'segredo123');
    await u.type(screen.getByLabelText('Nova senha'), 'NovaSenha9');
    await u.type(screen.getByLabelText('Confirmar nova senha'), 'Outra1234');
    await u.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('As senhas não conferem.')).toBeOnTheScreen();
    expect(callsTo('PUT', '/api/account/password')).toHaveLength(0);
    await u.clear(screen.getByLabelText('Confirmar nova senha'));
    await u.type(screen.getByLabelText('Confirmar nova senha'), 'NovaSenha9');
    await u.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Senha alterada\./)).toBeOnTheScreen();
    expect(callsTo('PUT', '/api/account/password')[0].body).toEqual({ currentPassword: 'segredo123', newPassword: 'NovaSenha9' });
    expect(keychain.has('fa.session')).toBe(true);
  });
});

import { http, HttpResponse } from 'msw';
import { API } from '../support/server';
const http_put_ok = () => http.put(`${API}/api/account/password`, () => HttpResponse.json(ME));
