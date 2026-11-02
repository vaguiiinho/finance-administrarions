/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization -- ponte entre o cliente HTTP (fora do React) e o estado da sessao: os refs so sao lidos em callbacks/efeitos, nunca durante a renderizacao. */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { classifyApiError, type ClassifiedError } from '@/core/api-errors';
import { DeferredActions } from '@/core/deferred-actions';
import type { Clock, TokenStore } from '@/core/ports';
import { initialSessionState, sessionReducer, type SessionState } from '@/core/session-machine';
import type { CurrentUserDto } from '@/lib/api/types';
import { createApi, type Api } from '@/data/api';
import { createApiClient, type UpdateRequiredDetails } from '@/data/http-client';
import { apiUrl } from '@/platform/config';
import { appVersion } from '@/platform/app-info';
import { installCheckReady } from '@/platform/install-check';
import { createSecureTokenStore } from '@/platform/secure-token-store';

export type LoginOutcome = { ok: true } | { ok: false; error: ClassifiedError };

interface SessionContextValue {
  state: SessionState;
  user: CurrentUserDto | null;
  /** Aviso da tela de entrar: "Sua sessao expirou. Entre novamente." (5.8). */
  sessionExpiredNotice: boolean;
  lastEmail: string;
  updateInfo: UpdateRequiredDetails | null;
  /** Motivo da tela de falha na abertura: rede/timeout ou resposta/erro inesperado. */
  bootFailure: 'NETWORK' | 'OTHER';
  api: Api;
  deferred: DeferredActions;
  /** Ids de exclusoes aguardando o fim do "Desfazer" (linha oculta). */
  pendingDeleteIds: readonly string[];
  login(email: string, password: string): Promise<LoginOutcome>;
  logout(): Promise<void>;
  retryBoot(): void;
  /** `GET /api/auth/me` de novo (403 FORBIDDEN: as acoes somem se a capacidade foi retirada). */
  refreshMe(): Promise<void>;
  setUser(user: CurrentUserDto): void;
  onDeferredFailure(listener: (id: string, error: unknown) => void): () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const systemClock: Clock = { now: () => new Date() };

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fora do SessionProvider');
  return value;
}

/** Renderiza as rotas protegidas so com sessao; ao expirar/sair, desmonta antes de qualquer `useMe` falhar. */
export function RequireUser({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user ? <>{children}</> : null;
}

/** Usuario autenticado; so valido dentro das rotas protegidas. */
export function useMe(): CurrentUserDto {
  const { user } = useSession();
  if (!user) throw new Error('useMe sem usuario autenticado');
  return user;
}

interface Props {
  children: ReactNode;
  tokenStore?: TokenStore;
  clock?: Clock;
}

export function SessionProvider({ children, tokenStore, clock = systemClock }: Props) {
  const queryClient = useQueryClient();
  const store = useMemo(() => tokenStore ?? createSecureTokenStore(), [tokenStore]);
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [sessionExpiredNotice, setNotice] = useState(false);
  const [lastEmail, setLastEmail] = useState('');
  const [updateInfo, setUpdateInfo] = useState<UpdateRequiredDetails | null>(null);
  const [bootFailure, setBootFailure] = useState<'NETWORK' | 'OTHER'>('NETWORK');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<readonly string[]>([]);
  const tokenRef = useRef<string | null>(null);
  const bootedRef = useRef(false);
  const failureListeners = useRef(new Set<(id: string, error: unknown) => void>());

  const deferred = useMemo(
    () =>
      new DeferredActions({
        onChange: setPendingDeleteIds,
        onFailure: (id, error) => failureListeners.current.forEach((listener) => listener(id, error)),
      }),
    [],
  );

  const dropSession = useCallback(async () => {
    tokenRef.current = null;
    deferred.discardAll();
    queryClient.clear();
    setUser(null);
    await store.clear().catch(() => undefined);
  }, [deferred, queryClient, store]);

  const handlers = useRef({
    expired: () => undefined as void,
    update: (_details: UpdateRequiredDetails) => undefined as void,
    passwordRequired: () => undefined as void,
  });

  const api = useMemo(() => {
    const client = createApiClient({
      baseUrl: apiUrl(),
      getToken: () => tokenRef.current,
      clientVersion: appVersion(),
      onSessionExpired: () => handlers.current.expired(),
      onUpdateRequired: (details) => handlers.current.update(details),
      onPasswordChangeRequired: () => handlers.current.passwordRequired(),
    });
    return createApi(client);
  }, []);

  /** Troca obrigatoria pendente (P-ADR1 variante A): nao fica sessao; logout em melhor esforco; tela "troque no site". */
  const enterPasswordPending = useCallback(
    async (token: string | null) => {
      deferred.discardAll();
      if (token) await api.logout(token).catch(() => undefined);
      await dropSession();
      dispatch({ type: 'MUST_CHANGE_PASSWORD' });
    },
    [api, deferred, dropSession],
  );

  useEffect(() => {
    handlers.current = {
      expired: () => {
        if (tokenRef.current === null) return;
        setNotice(true);
        void dropSession().then(() => dispatch({ type: 'SESSION_EXPIRED' }));
      },
      update: (details) => {
        deferred.discardAll();
        // Desmonta as rotas protegidas junto com a limpeza do cache (senao as consultas ativas refazem e voltam a dar 426).
        setUser(null);
        queryClient.clear();
        setUpdateInfo(details);
        dispatch({ type: 'UPDATE_REQUIRED' });
      },
      passwordRequired: () => {
        void enterPasswordPending(tokenRef.current);
      },
    };
  }, [deferred, dropSession, enterPasswordPending, queryClient]);

  const boot = useCallback(async () => {
    await installCheckReady();
    const stored = await store.read().catch(() => null);
    if (!stored) {
      dispatch({ type: 'NO_TOKEN' });
      return;
    }
    if (new Date(stored.expiresAt).getTime() <= clock.now().getTime()) {
      await store.clear().catch(() => undefined);
      setNotice(true);
      dispatch({ type: 'TOKEN_EXPIRED_LOCALLY' });
      return;
    }
    tokenRef.current = stored.token;
    dispatch({ type: 'TOKEN_FOUND' });
    try {
      const me = await api.me();
      if (me.mustChangePassword) {
        await enterPasswordPending(stored.token);
        return;
      }
      setUser(me);
      dispatch({ type: 'ME_OK' });
    } catch (error) {
      const kind = classifyApiError(error as never).kind;
      // 401, 426 e 403 de troca de senha ja foram tratados pelos ganchos do cliente HTTP.
      if (kind === 'SESSION_EXPIRED' || kind === 'UPDATE_REQUIRED' || kind === 'PASSWORD_CHANGE_REQUIRED') return;
      // Demais casos (rede, 5xx, resposta invalida, 429, 403...): tela com "Tentar novamente"; nunca fica preso em TOKEN_FOUND.
      setBootFailure(kind === 'NETWORK' || kind === 'TIMEOUT' ? 'NETWORK' : 'OTHER');
      dispatch({ type: 'NETWORK_ERROR' });
    }
  }, [api, clock, enterPasswordPending, store]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void boot();
  }, [boot]);

  // Segundo plano: envia na hora as exclusoes que aguardam o "Desfazer" (DM14).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void deferred.flush();
    });
    return () => subscription.remove();
  }, [deferred]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      setLastEmail(email);
      try {
        const { user: me, session } = await api.login(email, password);
        if (me.mustChangePassword) {
          await enterPasswordPending(session.token);
          return { ok: true };
        }
        await store.write(session);
        tokenRef.current = session.token;
        queryClient.clear();
        setNotice(false);
        setUser(me);
        dispatch({ type: 'LOGIN_OK' });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: classifyApiError(error as never) };
      }
    },
    [api, enterPasswordPending, queryClient, store],
  );

  const logout = useCallback(async () => {
    const token = tokenRef.current;
    await deferred.flush().catch(() => undefined);
    if (token) await api.logout(token).catch(() => undefined);
    await dropSession();
    setNotice(false);
    dispatch({ type: 'LOGOUT' });
  }, [api, deferred, dropSession]);

  const retryBoot = useCallback(() => {
    dispatch({ type: 'RETRY' });
    void boot();
  }, [boot]);

  const refreshMe = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      // erros de sessao ja sao tratados pelo cliente HTTP
    }
  }, [api]);

  const onDeferredFailure = useCallback((listener: (id: string, error: unknown) => void) => {
    failureListeners.current.add(listener);
    return () => void failureListeners.current.delete(listener);
  }, []);

  const value: SessionContextValue = {
    state,
    user,
    sessionExpiredNotice,
    lastEmail,
    updateInfo,
    bootFailure,
    api,
    deferred,
    pendingDeleteIds,
    login,
    logout,
    retryBoot,
    refreshMe,
    setUser,
    onDeferredFailure,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
