import { eventNames, pullEvents } from '@test/support/builders.js';
import { sessionUuid, userId, userUuid } from '@test/support/identity-builders.js';
import { unwrap } from '@test/support/result.js';
import { Session } from './session.js';
import { SessionPolicy } from './session-policy.js';
import { SessionId } from './value-objects/session-id.js';
import { SessionTokenDigest } from './value-objects/session-token-digest.js';

const H24 = 24 * 60 * 60 * 1000;
// CA06: Ana entrou as 10:00 de 2026-11-01 (America/Sao_Paulo = 13:00Z).
const LOGIN = new Date('2026-11-01T13:00:00.000Z');
const digest = () => unwrap<SessionTokenDigest>(SessionTokenDigest.create('a'.repeat(64)));
const open = (now = LOGIN) =>
  Session.open({ id: unwrap<SessionId>(SessionId.create(sessionUuid(1))), userId: userId(userUuid(1)), tokenDigest: digest(), now });

describe('SessionPolicy', () => {
  it('ttl fixo de 24 h, sem renovacao (P03)', () => {
    expect(SessionPolicy.ttlMs).toBe(H24);
    expect(SessionPolicy.expiresAt(LOGIN)).toEqual(new Date(LOGIN.getTime() + H24));
  });
});

describe('Session (RF04, CA06)', () => {
  it('open: expiresAt = createdAt + 24 h e emite SessionOpened', () => {
    const s = open();
    expect(s.createdAt).toEqual(LOGIN);
    expect(s.expiresAt).toEqual(new Date('2026-11-02T13:00:00.000Z'));
    expect(eventNames(pullEvents(s))).toEqual(['SessionOpened']);
  });

  it('CA06: 09:59 do dia seguinte (SP) ainda vale; 10:00 ja expirou', () => {
    const s = open();
    expect(s.isActiveAt(new Date('2026-11-02T12:59:00.000Z'))).toBe(true);
    expect(s.isActiveAt(new Date('2026-11-02T13:00:00.000Z'))).toBe(false);
  });

  it('fronteira exata: 23:59:59.999 vale; 24:00:00.000 nao', () => {
    const s = open();
    expect(s.isActiveAt(new Date(LOGIN.getTime() + H24 - 1))).toBe(true);
    expect(s.isActiveAt(new Date(LOGIN.getTime() + H24))).toBe(false);
  });

  it('uso continuo nao renova: nao existe forma de estender a validade', () => {
    const s = open();
    const before = s.expiresAt.getTime();
    s.isActiveAt(new Date(LOGIN.getTime() + H24 / 2));
    expect(s.expiresAt.getTime()).toBe(before);
  });

  it('revoke emite SessionRevoked', () => {
    const s = open();
    pullEvents(s);
    s.revoke(new Date(LOGIN.getTime() + 1000));
    expect(eventNames(pullEvents(s))).toEqual(['SessionRevoked']);
  });

  it('SessionTokenDigest: hex de 64 caracteres', () => {
    expect(SessionTokenDigest.create('a'.repeat(64)).ok).toBe(true);
    expect(SessionTokenDigest.create('a'.repeat(63)).ok).toBe(false);
    expect(SessionTokenDigest.create('g'.repeat(64)).ok).toBe(false);
  });
});
