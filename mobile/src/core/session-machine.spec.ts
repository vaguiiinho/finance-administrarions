import { initialSessionState, sessionReducer } from '@/core/session-machine';

const run = (events: string[], from = initialSessionState) => events.reduce((s, type) => sessionReducer(s, { type } as never), from);

describe('maquina de sessao (ADR 0011 10.8)', () => {
  it('estado inicial booting', () => expect(initialSessionState).toBe('booting'));
  it.each([
    ['booting', 'TOKEN_FOUND', 'booting'],
    ['booting', 'TOKEN_EXPIRED_LOCALLY', 'signedOut'],
    ['booting', 'ME_OK', 'signedIn'],
    ['booting', 'ME_401', 'signedOut'],
    ['booting', 'NETWORK_ERROR', 'offline'],
    ['booting', 'MUST_CHANGE_PASSWORD', 'passwordChangeRequired'],
    ['offline', 'ME_OK', 'signedIn'],
    ['signedOut', 'LOGIN_OK', 'signedIn'],
    ['signedOut', 'MUST_CHANGE_PASSWORD', 'passwordChangeRequired'],
    ['signedIn', 'SESSION_EXPIRED', 'signedOut'],
    ['signedIn', 'MUST_CHANGE_PASSWORD', 'passwordChangeRequired'],
    ['signedIn', 'UPDATE_REQUIRED', 'updateRequired'],
    ['signedIn', 'LOGOUT', 'signedOut'],
    ['passwordChangeRequired', 'LOGOUT', 'signedOut'],
  ])('%s + %s -> %s', (from, ev, to) => expect(run([ev], from as never)).toBe(to));

  it('LOGIN_OK com troca pendente nunca chega a signedIn', () => expect(run(['MUST_CHANGE_PASSWORD'], 'signedOut' as never)).not.toBe('signedIn'));
});
