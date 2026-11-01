import { readFileSync } from 'node:fs';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import { unwrap } from '@test/support/result.js';
import { ReferenceMonth } from '../billing/reference-month.js';
import { resolveInitialMonth } from './resolve-initial-month.js';

const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));

interface Case {
  ca: string;
  name: string;
  currentMonth: string;
  firstPendingMonth: string | null;
  oldestPendingCardMonth?: string | null;
  hasCard: boolean;
  month: string;
  advance: 'NONE' | 'NEXT_PENDING' | 'NO_PENDING_AHEAD';
}
// Fixture compartilhada com o stub do web (web/e2e/stub-api/initial-month.spec.ts): se a regra mudar aqui e o stub
// nao acompanhar, o teste de paridade do web quebra (ADR 0007 secao 10, S8).
const cases = JSON.parse(readFileSync(new URL('../../../../../test/fixtures/initial-month.cases.json', import.meta.url), 'utf8')) as Case[];

const decide = (c: Pick<Case, 'currentMonth' | 'firstPendingMonth' | 'oldestPendingCardMonth' | 'hasCard'>) =>
  resolveInitialMonth({
    currentMonth: rm(c.currentMonth),
    firstPendingMonth: c.firstPendingMonth ? rm(c.firstPendingMonth) : null,
    oldestPendingCardMonth: c.oldestPendingCardMonth ? rm(c.oldestPendingCardMonth) : null,
    hasCard: c.hasCard,
  });

describe('resolveInitialMonth: tabela do RF01 (ADR 0007 secao 3)', () => {
  it('a fixture cobre CA01 a CA21 sem buracos', () => {
    const covered = new Set(cases.map((c) => c.ca));
    for (let n = 1; n <= 21; n++) expect(covered.has(`CA${String(n).padStart(2, '0')}`), `CA${n}`).toBe(true);
    expect(covered.has('RFH01')).toBe(true);
  });

  it.each(cases.map((c) => [`${c.ca}: ${c.name}`, c] as const))('%s', (_name, c) => {
    const decision = decide(c);
    expect(decision.month.toString()).toBe(c.month);
    expect(decision.advance).toBe(c.advance);
  });

  it('devolve ReferenceMonth (value object), nao texto', () => {
    const decision = decide({ currentMonth: '2026-10', firstPendingMonth: null, oldestPendingCardMonth: null, hasCard: true });
    expect(decision.month).toBeInstanceOf(ReferenceMonth);
  });
});

describe('resolveInitialMonth: invariantes', () => {
  it('NONE nunca sinaliza avanço futuro; os demais invariantes de avanço futuro permanecem', () => {
    for (const c of cases) {
      const d = decide(c);
      const current = rm(c.currentMonth);
      if (d.advance === 'NEXT_PENDING' || d.advance === 'NO_PENDING_AHEAD') {
        expect(d.month.compare(current), c.name).toBeGreaterThan(0);
      }
      if (d.advance === 'NO_PENDING_AHEAD') {
        expect(c.hasCard, c.name).toBe(true);
        expect(d.month.toString(), c.name).toBe(current.next().toString());
      }
    }
  });

  it('firstPendingMonth anterior a M e erro de programacao, mas fatura anterior e dado valido', () => {
    expect(() => decide({ currentMonth: '2026-10', firstPendingMonth: '2026-09', hasCard: true })).toThrow(InvariantViolationError);
    expect(() => decide({ currentMonth: '2026-01', firstPendingMonth: '2025-12', hasCard: false })).toThrow(InvariantViolationError);
    expect(
      decide({ currentMonth: '2026-10', firstPendingMonth: null, oldestPendingCardMonth: '2026-09', hasCard: true }).month.toString(),
    ).toBe('2026-09');
  });

  it('nao muta os fatos recebidos', () => {
    const facts = { currentMonth: rm('2026-12'), firstPendingMonth: null, oldestPendingCardMonth: null, hasCard: true };
    resolveInitialMonth(facts);
    expect(facts.currentMonth.toString()).toBe('2026-12');
    expect(facts.firstPendingMonth).toBeNull();
  });
});
