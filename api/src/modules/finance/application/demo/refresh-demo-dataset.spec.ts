import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { FixedClock, SequentialIdGenerator } from '@test/fakes/simple-fakes.js';
import { FakeDemoDatasetStore, FixedBusinessCalendar } from '@test/fakes/demo-fakes.js';
import { NOW, rejected } from '@test/support/builders.js';
import { ownerOf } from '@test/support/owned-builders.js';
import { RefreshDemoDataset } from './refresh-demo-dataset.js';

function setup(month = '2026-10') {
  const store = new FakeDemoDatasetStore();
  const calendar = new FixedBusinessCalendar(month);
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(NOW);
  return { store, calendar, ids, clock, useCase: new RefreshDemoDataset(store, calendar, ids, clock) };
}

const monthsEnding = (anchor: string, count: number): string[] => {
  const [y, m] = anchor.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) - (count - 1) + i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
};
const nextMonth = (anchor: string) => {
  const [y, m] = anchor.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

async function build(month: string) {
  const s = setup(month);
  await s.useCase.execute({ ownerId: DEMO_USER_ID });
  return s.store.calls[0].build();
}

describe('RefreshDemoDataset (RF28, CA34)', () => {
  it('delega ao store com o dono demo, o mes corrente do calendario de negocio e uma versao de template', async () => {
    const s = setup('2026-10');
    await s.useCase.execute({ ownerId: DEMO_USER_ID });
    expect(s.store.calls).toHaveLength(1);
    expect(s.store.calls[0]).toMatchObject({ ownerId: DEMO_USER_ID, anchor: '2026-10' });
    expect(Number.isInteger(s.store.calls[0].version) && s.store.calls[0].version >= 1).toBe(true);
  });

  it('quando o mes corrente muda, a ancora acompanha (dados ate o novo mes atual)', async () => {
    const s = setup('2026-10');
    await s.useCase.execute({ ownerId: DEMO_USER_ID });
    s.calendar.set('2026-11');
    await s.useCase.execute({ ownerId: DEMO_USER_ID });
    expect(s.store.calls.map((c) => c.anchor)).toEqual(['2026-10', '2026-11']);
  });

  it('aceita ancora explicita (AAAA-MM)', async () => {
    const s = setup('2026-10');
    await s.useCase.execute({ ownerId: DEMO_USER_ID, anchor: '2027-03' });
    expect(s.store.calls[0].anchor).toBe('2027-03');
  });

  it('devolve o que o store decidiu: refreshed true/false (idempotencia e do store)', async () => {
    const s = setup();
    expect(await s.useCase.execute({ ownerId: DEMO_USER_ID })).toEqual({ refreshed: true });
    s.store.staleResult = false;
    expect(await s.useCase.execute({ ownerId: DEMO_USER_ID })).toEqual({ refreshed: false });
  });

  it('ownerId malformado e erro de programacao', async () => {
    const s = setup();
    const error = await rejected(s.useCase.execute({ ownerId: 'abc' }));
    expect(error.name).toBe('InvariantViolationError');
    expect(s.store.calls).toHaveLength(0);
  });
});

describe('conteudo do dataset demo (RF28)', () => {
  it('pelo menos 2 cartoes com fechamento e vencimento diferentes, todos do usuario demo', async () => {
    const { cards } = await build('2026-10');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    const pairs = new Set(cards.map((c) => `${c.closingDay.value}/${c.dueDay.value}`));
    expect(pairs.size).toBeGreaterThanOrEqual(2);
    expect(new Set(cards.map((c) => c.name.key)).size).toBe(cards.length);
    for (const c of cards) expect(ownerOf(c as never)).toBe(DEMO_USER_ID);
  });

  it('receitas e despesas PIX pagas e pendentes; pelo menos 5 categorias; tudo do usuario demo', async () => {
    const { entries } = await build('2026-10');
    const snaps = entries.map((e) => e.toSnapshot());
    expect(snaps.some((s) => s.type === 'INCOME')).toBe(true);
    expect(snaps.some((s) => s.type === 'EXPENSE' && s.paymentMethod === 'PIX' && s.status === 'PAID')).toBe(true);
    expect(snaps.some((s) => s.type === 'EXPENSE' && s.paymentMethod === 'PIX' && s.status === 'PENDING')).toBe(true);
    expect(new Set(snaps.map((s) => s.category.key)).size).toBeGreaterThanOrEqual(5);
    for (const e of entries) expect(ownerOf(e as never)).toBe(DEMO_USER_ID);
  });

  it('despesas no cartao em pelo menos 2 faturas, sempre em cartao do proprio dataset', async () => {
    const { cards, entries } = await build('2026-10');
    const cardIds = new Set(cards.map((c) => c.id.value));
    const cardSnaps = entries.map((e) => e.toSnapshot()).filter((s) => s.paymentMethod === 'CARD');
    expect(new Set(cardSnaps.map((s) => `${s.cardId!.value}|${s.referenceMonth}`)).size).toBeGreaterThanOrEqual(2);
    for (const s of cardSnaps) expect(cardIds.has(s.cardId!.value)).toBe(true);
  });

  it.each(['2026-10', '2027-02', '2026-12', '2027-01'])(
    'CA34: cobre os 12 meses que terminam em %s e o mes seguinte (fatura futura) e nada fora disso',
    async (anchor) => {
      const { entries } = await build(anchor);
      const refs = entries.map((e) => e.toSnapshot().referenceMonth.toString());
      for (const month of monthsEnding(anchor, 12)) expect(refs, `mes ${month}`).toContain(month);
      const futureInvoice = entries
        .map((e) => e.toSnapshot())
        .filter((s) => s.paymentMethod === 'CARD' && s.referenceMonth.toString() === nextMonth(anchor));
      expect(futureInvoice.length).toBeGreaterThanOrEqual(1);
      const allowed = new Set([...monthsEnding(anchor, 12), nextMonth(anchor)]);
      for (const ref of refs) expect(allowed.has(ref), `referencia fora da janela: ${ref}`).toBe(true);
    },
  );

  it('valores e descricoes sao fixos: so as datas acompanham o mes (mesmo multiconjunto em ancoras diferentes)', async () => {
    const a = (await build('2026-10')).entries.map((e) => e.toSnapshot());
    const b = (await build('2027-02')).entries.map((e) => e.toSnapshot());
    const sig = (s: (typeof a)[number]) => `${s.type}|${s.description.value}|${s.category.value}|${s.amount.toString()}`;
    expect(a.map(sig).sort()).toEqual(b.map(sig).sort());
  });

  it('ids unicos e createdAt vindo do Clock', async () => {
    const { cards, entries } = await build('2026-10');
    const ids = [...cards.map((c) => c.id.value), ...entries.map((e) => e.id.value)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of entries) expect(e.toSnapshot().createdAt).toEqual(NOW);
  });
});
