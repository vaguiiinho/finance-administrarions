/** Maquina de sessao pura (ADR 0011 10.8). */
export type SessionState = 'booting' | 'signedOut' | 'passwordChangeRequired' | 'signedIn' | 'offline' | 'updateRequired';

export type SessionEvent =
  | { type: 'TOKEN_FOUND' }
  | { type: 'NO_TOKEN' }
  | { type: 'TOKEN_EXPIRED_LOCALLY' }
  | { type: 'ME_OK' }
  | { type: 'ME_401' }
  | { type: 'NETWORK_ERROR' }
  | { type: 'RETRY' }
  | { type: 'LOGIN_OK' }
  | { type: 'MUST_CHANGE_PASSWORD' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'UPDATE_REQUIRED' }
  | { type: 'LOGOUT' };

export const initialSessionState: SessionState = 'booting';

export function sessionReducer(current: SessionState | string, event: SessionEvent): SessionState {
  const state = current as SessionState;
  switch (event.type) {
    case 'UPDATE_REQUIRED':
      return 'updateRequired';
    case 'MUST_CHANGE_PASSWORD':
      return 'passwordChangeRequired';
    case 'LOGOUT':
    case 'SESSION_EXPIRED':
      return state === 'updateRequired' && event.type === 'SESSION_EXPIRED' ? state : 'signedOut';
    case 'TOKEN_FOUND':
      return state;
    case 'NO_TOKEN':
    case 'TOKEN_EXPIRED_LOCALLY':
    case 'ME_401':
      return state === 'booting' || state === 'offline' ? 'signedOut' : state;
    case 'NETWORK_ERROR':
      return state === 'booting' ? 'offline' : state;
    case 'RETRY':
      return state === 'offline' || state === 'updateRequired' ? 'booting' : state;
    case 'ME_OK':
      return state === 'booting' || state === 'offline' ? 'signedIn' : state;
    case 'LOGIN_OK':
      return state === 'signedOut' ? 'signedIn' : state;
  }
}
