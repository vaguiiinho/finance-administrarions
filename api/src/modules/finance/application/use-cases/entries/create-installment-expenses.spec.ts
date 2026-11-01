import { DEFAULT_OWNER, rawEntry } from '@test/support/builders.js';
import { buildHarness } from '@test/support/finance-harness.js';

const request = (over: Partial<{
  description: string;
  category: string;
  date: string;
  amount: string;
  installments: number;
  paymentMethod: string;
  cardId: string | null;
}> = {}) => ({
  ownerId: DEFAULT_OWNER.value,
  description: 'Notebook',
  category: 'Eletrônicos',
  date: '2026-11-15',
  amount: '350.00',
  installments: 6,
  paymentMethod: 'PIX',
  ...over,
});

describe('CreateInstallmentExpenses', () => {
  it('creates monthly pending entries with exact total and remainder cents on first installments', async () => {
    const h = buildHarness();

    const result = await h.createInstallmentExpenses.execute(request());

    expect(result).toHaveLength(6);
    expect(result.map((item) => item.date.toString())).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
      '2027-03-15',
      '2027-04-15',
    ]);
    expect(result.map((item) => item.amount.toString())).toEqual([
      '58.34',
      '58.34',
      '58.33',
      '58.33',
      '58.33',
      '58.33',
    ]);
    expect(result.every((item) => item.type === 'EXPENSE' && item.status === 'PENDING' && item.paidAt === null)).toBe(true);
    expect(h.entries.all()).toHaveLength(6);
    expect(h.publisher.names()).toEqual(Array(6).fill('EntryCreated'));
  });

  it('creates one invoice snapshot per month when payment method is card', async () => {
    const h = buildHarness();
    const card = await h.createCard.execute({ name: 'Parcelado', closingDay: 25, dueDay: 5 });

    const result = await h.createInstallmentExpenses.execute(request({ paymentMethod: 'CARD', cardId: card.id, installments: 3 }));

    expect(result.map((item) => item.invoice?.closingDate.toString())).toEqual([
      '2026-11-25',
      '2026-12-25',
      '2027-01-25',
    ]);
    expect(result.map((item) => item.referenceMonth.toString())).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(result.every((item) => item.card?.id === card.id && item.status === 'PENDING')).toBe(true);
  });

  it('rejects a card that no longer exists without creating installments', async () => {
    const h = buildHarness();
    const card = await h.createCard.execute({ name: 'Removido', closingDay: 25, dueDay: 5 });
    h.cards.store.delete(card.id);

    await expect(
      h.createInstallmentExpenses.execute(request({ paymentMethod: 'CARD', cardId: card.id })),
    ).rejects.toMatchObject({ code: 'CARD_NOT_FOUND' });

    expect(h.entries.all()).toEqual([]);
    expect(h.publisher.names()).toEqual(['CardCreated']);
  });

  it('keeps canonical category spelling from the owner catalog', async () => {
    const h = buildHarness();
    await h.createEntry.execute(rawEntry({ category: 'Eletrônicos' }));

    const result = await h.createInstallmentExpenses.execute(request({ category: 'eletrônicos' }));

    expect(result.every((item) => item.category === 'Eletrônicos')).toBe(true);
  });

  it('rolls back all rows and publishes no events if one insert fails', async () => {
    const h = buildHarness();
    const insert = h.entries.insert.bind(h.entries);
    let attempts = 0;
    h.entries.insert = async (entry) => {
      attempts++;
      if (attempts === 3) throw new Error('simulated insert failure');
      await insert(entry);
    };

    await expect(h.createInstallmentExpenses.execute(request())).rejects.toThrow('simulated insert failure');

    expect(h.entries.all()).toEqual([]);
    expect(h.publisher.names()).toEqual([]);
    expect(h.uow.rollbacks).toBe(1);
  });
});
