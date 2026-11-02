import { CAST, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { ATTEMPT_LIMITER } from '@identity/application/ports/attempt-limiter.js';
import { InMemoryAttemptLimiter } from '@identity/infrastructure/in-memory-attempt-limiter.js';

/** CA31 (ADR 0011 6.1, 11.1): `TRUST_PROXY=127.0.0.1` simula o nginx como UNICO proxy confiavel (o peer do supertest). */
let e: IdentityE2e;
const previous = process.env.TRUST_PROXY;
beforeAll(async () => {
  process.env.TRUST_PROXY = '127.0.0.1';
  e = await startIdentityE2e();
});
afterAll(async () => {
  await e.close();
  if (previous === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previous;
});
beforeEach(async () => {
  await e.resetAll();
  (e.app.get(ATTEMPT_LIMITER) as InMemoryAttemptLimiter).clear();
  await e.seedUser(CAST.ana);
});

const attempt = (xff: string) => e.http().post('/api/auth/login').set('X-Forwarded-For', xff).send({ email: 'ana@exemplo.com', password: 'segredo123' });

describe('CA31: limite por IP real atras do nginx', () => {
  it('21 logins do mesmo cliente (o nginx sobrescreve o XFF com $remote_addr): o 21o responde 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await attempt('203.0.113.50')).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('XFF forjado pelo cliente a esquerda do IP real nao reinicia o limite', async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await attempt(`10.${i}.0.1, 203.0.113.51`)).status;
    expect(last).toBe(429);
  });

  it('outro cliente real (outro IP) nao e afetado pelo limite do primeiro', async () => {
    for (let i = 0; i < 21; i++) await attempt('203.0.113.52');
    expect((await attempt('203.0.113.53')).status).toBe(200);
  });
});
