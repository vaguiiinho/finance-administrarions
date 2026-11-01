import { InvariantViolationError } from '@shared/domain/app-error.js';
import { SaoPauloBusinessCalendar } from '@shared/infrastructure/sao-paulo-business-calendar.js';
import { unwrap } from '@test/support/result.js';
import { rejected } from '@test/support/builders.js';
import { FixedClock } from '@test/fakes/simple-fakes.js';
import { FixedBusinessCalendar } from '@test/fakes/demo-fakes.js';
import { ANA, BRUNO } from '@test/support/owned-builders.js';
import { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import type { OwnerId } from '../../../domain/owner/owner-id.js';
import type { PendingOverviewReadModel } from '../../ports/pending-overview-read-model.js';
import { GetInitialEntriesMonth } from './get-initial-entries-month.js';

const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));

interface OwnerData {
  /** Meses de referencia das despesas PENDENTES (fatura ou PIX) do dono. */
  pending: string[];
  /** Meses de referência de faturas de cartão PENDENTES, inclusive anteriores ao mês consultado. */
  pendingCard?: string[];
  hasCard: boolean;
}

/** Fake que obedece o contrato do port: so olha de `from` (inclusive) em diante e exige o dono. */
function fakeOverview(data: Record<string, OwnerData>) {
  const calls: { owner: string; from: string }[] = [];
  const readModel: PendingOverviewReadModel = {
    async overviewFrom(ownerId: OwnerId, from: ReferenceMonth) {
      calls.push({ owner: ownerId.value, from: from.toString() });
      const mine = data[ownerId.value];
      if (!mine) throw new Error(`dono inesperado: ${ownerId.value}`);
      const ahead = mine.pending.map(rm).filter((m) => m.compare(from) >= 0).sort((a, b) => a.compare(b));
      const cardMonths = (mine.pendingCard ?? []).map(rm).sort((a, b) => a.compare(b));
      return { firstPendingMonth: ahead[0] ?? null, oldestPendingCardMonth: cardMonths[0] ?? null, hasCard: mine.hasCard };
    },
  };
  return { readModel, calls };
}

const at = (iso: string) => new SaoPauloBusinessCalendar(new FixedClock(new Date(iso)));
const run = async (overview: PendingOverviewReadModel, calendar: { currentMonth(): unknown }, ownerId = ANA) => {
  const out = await new GetInitialEntriesMonth(overview, calendar as never).execute({ ownerId });
  return { currentMonth: out.currentMonth.toString(), month: out.month.toString(), advance: out.advance };
};

describe('GetInitialEntriesMonth (ADR 0007 5.2)', () => {
  it('consulta o port UMA vez, com o dono e M (mes atual) como ponto de partida', async () => {
    const { readModel, calls } = fakeOverview({ [ANA]: { pending: ['2026-10'], hasCard: true } });
    await run(readModel, new FixedBusinessCalendar('2026-10'));
    expect(calls).toEqual([{ owner: ANA, from: '2026-10' }]);
  });

  it('devolve currentMonth, month e advance (CA01: pendencia em M -> M, sem avanco)', async () => {
    const { readModel } = fakeOverview({ [ANA]: { pending: ['2026-10'], hasCard: true } });
    expect(await run(readModel, new FixedBusinessCalendar('2026-10'))).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('CA02/CA08: com cartao e sem pendencia -> M+1 e NO_PENDING_AHEAD', async () => {
    const { readModel } = fakeOverview({ [ANA]: { pending: [], hasCard: true } });
    expect(await run(readModel, new FixedBusinessCalendar('2026-10'))).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA06/CA07: pega o PRIMEIRO mes futuro com pendencia, sem limite de distancia', async () => {
    const { readModel } = fakeOverview({ [ANA]: { pending: ['2026-12', '2027-03'], hasCard: true } });
    expect(await run(readModel, new FixedBusinessCalendar('2026-10'))).toMatchObject({ month: '2026-12', advance: 'NEXT_PENDING' });
  });

  it('CA11: sem cartao e sem pendencia -> fica em M', async () => {
    const { readModel } = fakeOverview({ [ANA]: { pending: [], hasCard: false } });
    expect(await run(readModel, new FixedBusinessCalendar('2026-10'))).toMatchObject({ month: '2026-10', advance: 'NONE' });
  });

  it('CA14: PIX pendente anterior a M nao interfere', async () => {
    const { readModel } = fakeOverview({ [ANA]: { pending: ['2026-09'], hasCard: true } });
    expect(await run(readModel, new FixedBusinessCalendar('2026-10'))).toMatchObject({ month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('RFH01: fatura de cartao pendente anterior a M e escolhida antes das pendencias atuais', async () => {
    const { readModel } = fakeOverview({
      [ANA]: { pending: ['2026-11'], pendingCard: ['2026-11', '2026-10'], hasCard: true },
    });
    expect(await run(readModel, new FixedBusinessCalendar('2026-11'))).toEqual({
      currentMonth: '2026-11',
      month: '2026-10',
      advance: 'NONE',
    });
  });

  it('CA23: isolamento - Ana (cartao, sem pendencia) abre em novembro mesmo com Bruno pendente em out e dez', async () => {
    const { readModel, calls } = fakeOverview({
      [ANA]: { pending: [], hasCard: true },
      [BRUNO]: { pending: ['2026-10', '2026-12'], hasCard: true },
    });
    const calendar = new FixedBusinessCalendar('2026-10');
    expect(await run(readModel, calendar, ANA)).toMatchObject({ month: '2026-11', advance: 'NO_PENDING_AHEAD' });
    expect(calls.map((c) => c.owner)).toEqual([ANA]);
    expect(await run(readModel, calendar, BRUNO)).toMatchObject({ month: '2026-10', advance: 'NONE' });
  });

  it('dono malformado e erro de programacao (500), sem consultar o port', async () => {
    const { readModel, calls } = fakeOverview({});
    const error = await rejected(new GetInitialEntriesMonth(readModel, new FixedBusinessCalendar('2026-10')).execute({ ownerId: 'abc' }));
    expect(error).toBeInstanceOf(InvariantViolationError);
    expect(calls).toEqual([]);
  });

  it('falha do port propaga (o web decide cair em M; o caso de uso nao engole o erro)', async () => {
    const readModel: PendingOverviewReadModel = { overviewFrom: vi.fn(async () => { throw new Error('banco fora'); }) };
    await expect(new GetInitialEntriesMonth(readModel, new FixedBusinessCalendar('2026-10')).execute({ ownerId: ANA })).rejects.toThrow('banco fora');
  });
});

describe('GetInitialEntriesMonth com o relogio real de negocio (America/Sao_Paulo): CA18, CA19, CA20', () => {
  const withPending = (pending: string[]) => fakeOverview({ [ANA]: { pending, hasCard: true } }).readModel;

  it('CA18: 2026-11-01T02:30Z = 31/10 23:30 em SP -> M = outubro', async () => {
    const calendar = at('2026-11-01T02:30:00.000Z');
    expect(await run(withPending(['2026-10']), calendar)).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
    expect(await run(withPending([]), calendar)).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA19: 2026-11-01T03:30Z = 01/11 00:30 em SP -> M = novembro; pendencia so em outubro nao conta', async () => {
    const calendar = at('2026-11-01T03:30:00.000Z');
    expect(await run(withPending(['2026-11']), calendar)).toEqual({ currentMonth: '2026-11', month: '2026-11', advance: 'NONE' });
    expect(await run(withPending(['2026-10']), calendar)).toEqual({ currentMonth: '2026-11', month: '2026-12', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA20: 2027-01-01T02:30Z = 31/12 23:30 em SP -> M = dezembro de 2026; sem pendencia -> janeiro de 2027', async () => {
    const calendar = at('2027-01-01T02:30:00.000Z');
    expect(await run(withPending(['2026-12']), calendar)).toEqual({ currentMonth: '2026-12', month: '2026-12', advance: 'NONE' });
    expect(await run(withPending([]), calendar)).toEqual({ currentMonth: '2026-12', month: '2027-01', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA15/CA16: virada de ano com salto (M = 20/11/2026, proxima pendencia em 2027-02)', async () => {
    const calendar = at('2026-11-20T15:00:00.000Z');
    expect(await run(withPending(['2027-02']), calendar)).toEqual({ currentMonth: '2026-11', month: '2027-02', advance: 'NEXT_PENDING' });
  });
});
