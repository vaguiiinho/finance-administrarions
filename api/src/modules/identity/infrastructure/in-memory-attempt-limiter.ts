import type { Clock } from '@shared/application/ports/clock.js';
import { ATTEMPT_POLICIES } from '../application/policies/attempt-policies.js';
import type { AttemptDecision, AttemptKey, AttemptLimiter } from '../application/ports/attempt-limiter.js';

const SWEEP_EVERY = 500;

/** Janela deslizante em memória por chave (D7). Estado por processo; a API roda em uma instância. */
export class InMemoryAttemptLimiter implements AttemptLimiter {
  private readonly events = new Map<string, number[]>();
  private operations = 0;

  constructor(
    private readonly clock: Clock,
    private readonly policies = ATTEMPT_POLICIES,
  ) {}

  async consume(key: AttemptKey): Promise<AttemptDecision> {
    const { now, window, attempts } = this.window(key);
    const decision = this.decide(key, attempts, now, window);
    if (decision.allowed) attempts.push(now);
    return decision;
  }

  async peek(key: AttemptKey): Promise<AttemptDecision> {
    const { now, window, attempts } = this.window(key);
    return this.decide(key, attempts, now, window);
  }

  async recordFailure(key: AttemptKey): Promise<void> {
    this.window(key).attempts.push(this.clock.now().getTime());
  }

  async reset(key: AttemptKey): Promise<void> {
    this.events.delete(this.id(key));
  }

  /** Esquece todas as chaves. Não faz parte do port: serve para isolar testes que compartilham o processo. */
  clear(): void {
    this.events.clear();
  }

  private decide(key: AttemptKey, attempts: number[], now: number, window: number): AttemptDecision {
    if (attempts.length < this.policies[key.scope].limit) return { allowed: true };
    const retryAfterMs = (attempts[0] as number) + window - now;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  /** Devolve as ocorrências vivas da chave (as mais antigas que a janela são descartadas). */
  private window(key: AttemptKey) {
    const now = this.clock.now().getTime();
    const window = this.policies[key.scope].windowSeconds * 1000;
    if (++this.operations % SWEEP_EVERY === 0) this.sweep(now);
    const id = this.id(key);
    const alive = (this.events.get(id) ?? []).filter((at) => now - at < window);
    this.events.set(id, alive);
    return { now, window, attempts: alive };
  }

  private sweep(now: number): void {
    const longest = Math.max(...Object.values(this.policies).map((p) => p.windowSeconds)) * 1000;
    for (const [id, attempts] of this.events) {
      if (attempts.length === 0 || now - (attempts[attempts.length - 1] as number) >= longest) this.events.delete(id);
    }
  }

  private id(key: AttemptKey): string {
    return `${key.scope}\u0000${key.value}`;
  }
}
