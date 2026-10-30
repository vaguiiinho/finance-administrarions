import { FixedClock } from '@test/fakes/simple-fakes.js';
import { NOW } from '@test/support/builders.js';
import { InMemoryAttemptLimiter } from './in-memory-attempt-limiter.js';

const mk = () => {
  const clock = new FixedClock(NOW);
  return { clock, limiter: new InMemoryAttemptLimiter(clock) };
};
const at = (s: number) => new Date(NOW.getTime() + s * 1000);
const ip = (value = '198.51.100.7') => ({ scope: 'auth-ip' as const, value });
const email = (value = 'ana@exemplo.com') => ({ scope: 'login-email-failures' as const, value });

describe('InMemoryAttemptLimiter (RNF04, ADR D7)', () => {
  it('auth-ip: 20 requisicoes por 60 s passam; a 21a e negada com retryAfterSeconds entre 1 e 60', async () => {
    const { limiter } = mk();
    for (let i = 0; i < 20; i++) expect(await limiter.consume(ip())).toEqual({ allowed: true });
    const denied = await limiter.consume(ip());
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSeconds).toBeGreaterThan(0);
      expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it('auth-ip: depois da janela de 60 s volta a permitir; IPs sao independentes', async () => {
    const { limiter, clock } = mk();
    for (let i = 0; i < 21; i++) await limiter.consume(ip());
    expect((await limiter.consume(ip('198.51.100.8'))).allowed).toBe(true);
    clock.set(at(61));
    expect((await limiter.consume(ip())).allowed).toBe(true);
  });

  it('falhas por e-mail: peek nao bloqueia com 4 falhas e bloqueia com 5 (mesmo sem nova tentativa)', async () => {
    const { limiter } = mk();
    for (let i = 0; i < 4; i++) await limiter.recordFailure(email());
    expect((await limiter.peek(email())).allowed).toBe(true);
    await limiter.recordFailure(email());
    const blocked = await limiter.peek(email());
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
    }
  });

  it('peek nao conta tentativa', async () => {
    const { limiter } = mk();
    for (let i = 0; i < 50; i++) await limiter.peek(email());
    expect((await limiter.peek(email())).allowed).toBe(true);
  });

  it('as falhas expiram apos 15 min', async () => {
    const { limiter, clock } = mk();
    for (let i = 0; i < 5; i++) await limiter.recordFailure(email());
    clock.set(at(15 * 60 + 1));
    expect((await limiter.peek(email())).allowed).toBe(true);
  });

  it('reset zera as falhas da chave; outras chaves e escopos nao sao afetados', async () => {
    const { limiter } = mk();
    for (let i = 0; i < 5; i++) await limiter.recordFailure(email());
    for (let i = 0; i < 5; i++) await limiter.recordFailure(email('bruno@exemplo.com'));
    await limiter.reset(email());
    expect((await limiter.peek(email())).allowed).toBe(true);
    expect((await limiter.peek(email('bruno@exemplo.com'))).allowed).toBe(false);
    for (let i = 0; i < 5; i++) await limiter.recordFailure({ scope: 'password-change-user-failures', value: 'ana@exemplo.com' });
    expect((await limiter.peek(email())).allowed).toBe(true);
  });
});
