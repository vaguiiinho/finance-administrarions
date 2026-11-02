import {
  parseCards, parseCategories, parseCurrentUser, parseDistribution, parseExpensesPage, parseIncomesPage, parseInvoiceEntries, parseInvoices,
  parseSeries, parseSummary, parseAuthResponse, parseInitialMonth,
} from '@/data/api';

const expenses = { total: '600.00', paid: '100.00', pending: '500.00' };
const totals = { income: '5000.00', expenses, balance: { realized: '4900.00', projected: '4400.00' } };
const entry = {
  id: 'e1', type: 'EXPENSE', description: 'Mercado', category: 'Alimentação', date: '2026-10-15', amount: '230.50', paymentMethod: 'PIX', card: null,
  invoice: null, referenceMonth: '2026-10', status: 'PENDING', paidAt: null, createdAt: '2026-10-24T13:00:00.000Z', updatedAt: '2026-10-24T13:00:00.000Z',
};
const pagination = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
const user = { id: 'u1', name: 'Ana', email: 'a@b.c', role: 'USER', mustChangePassword: false, accountKind: 'REGULAR', capabilities: ['MANAGE_EXPENSES'] };
const invoice = { card: { id: 'c1', name: 'Nubank' }, referenceMonth: '2026-11', closingDate: '2026-11-10', dueDate: '2026-11-20', entryCount: 3, pendingCount: 2, totals: expenses };

describe('parsers do contrato HTTP (docs/api/finance.md)', () => {
  it('summary: aceita { month, totals } e rejeita totais soltos', () => {
    expect(parseSummary({ month: '2026-11', totals })).toEqual(totals);
    expect(() => parseSummary(totals)).toThrow(TypeError);
    expect(() => parseSummary(null)).toThrow(TypeError);
    expect(() => parseSummary({ month: '2026-11', totals: { ...totals, income: 5000 } })).toThrow(TypeError);
  });

  it('series: exige points', () => {
    const ok = { from: '2025-12', to: '2026-11', points: [{ month: '2026-11', totals }] };
    expect(parseSeries(ok)).toEqual(ok);
    expect(() => parseSeries({ from: 'a', to: 'b', items: [] })).toThrow(TypeError);
    expect(() => parseSeries({ from: 'a', to: 'b' })).toThrow(TypeError);
    expect(() => parseSeries({ ...ok, points: [{ month: '2026-11' }] })).toThrow(TypeError);
  });

  it('distribution', () => {
    const ok = { month: '2026-11', total: '600.00', items: [{ category: 'A', total: '450.00', percentage: '75.00' }] };
    expect(parseDistribution(ok)).toEqual(ok);
    expect(() => parseDistribution({ month: '2026-11', items: [] })).toThrow(TypeError);
    expect(() => parseDistribution({ ...ok, items: [{ category: 'A', total: '1.00' }] })).toThrow(TypeError);
  });

  it('despesas: exige subtotal e pagination', () => {
    const ok = { month: '2026-11', items: [entry], pagination, subtotal: expenses };
    expect(parseExpensesPage(ok)).toEqual(ok);
    expect(() => parseExpensesPage({ ...ok, subtotal: undefined })).toThrow(TypeError);
    expect(() => parseExpensesPage({ ...ok, totals: expenses, subtotal: undefined })).toThrow(TypeError);
    expect(() => parseExpensesPage({ ...ok, pagination: undefined })).toThrow(TypeError);
    expect(() => parseExpensesPage({ ...ok, items: undefined })).toThrow(TypeError);
    expect(() => parseExpensesPage({ ...ok, items: [{ id: 'x' }] })).toThrow(TypeError);
  });

  it('receitas: subtotal { total }', () => {
    const ok = { month: '2026-11', items: [entry], pagination, subtotal: { total: '5000.00' } };
    expect(parseIncomesPage(ok)).toEqual(ok);
    expect(() => parseIncomesPage({ ...ok, subtotal: undefined, totals: { total: '1.00' } })).toThrow(TypeError);
    expect(() => parseIncomesPage({ ...ok, subtotal: {} })).toThrow(TypeError);
  });

  it('faturas: entryCount, pendingCount e totals obrigatorios', () => {
    expect(parseInvoices({ month: '2026-11', items: [invoice] })).toEqual([invoice]);
    expect(parseInvoices({ month: '2026-11', items: [] })).toEqual([]);
    const { entryCount, ...semCount } = invoice;
    void entryCount;
    expect(() => parseInvoices({ items: [{ ...semCount, entriesCount: 3 }] })).toThrow(TypeError);
    expect(() => parseInvoices({ items: [{ ...invoice, totals: undefined }] })).toThrow(TypeError);
    expect(() => parseInvoices({})).toThrow(TypeError);
  });

  it('listas com items: fatura, categorias e cartoes', () => {
    expect(parseInvoiceEntries({ card: { id: 'c1', name: 'N' }, referenceMonth: '2026-11', items: [entry] })).toEqual([entry]);
    expect(() => parseInvoiceEntries({})).toThrow(TypeError);
    expect(parseCategories({ items: ['A'] })).toEqual(['A']);
    expect(() => parseCategories({})).toThrow(TypeError);
    expect(() => parseCategories({ items: [1] })).toThrow(TypeError);
    const card = { id: 'c1', name: 'N', closingDay: 1, dueDay: 2, createdAt: 'x', updatedAt: 'y' };
    expect(parseCards({ items: [card] })).toEqual([card]);
    expect(() => parseCards([card])).toThrow(TypeError);
  });

  it('usuario atual: corpo direto, sem envelope { user }', () => {
    expect(parseCurrentUser(user)).toEqual(user);
    expect(() => parseCurrentUser({ user })).toThrow(TypeError);
    expect(() => parseCurrentUser({ ...user, capabilities: undefined })).toThrow(TypeError);
  });

  it('login: valida user, token nao vazio e expiresAt ISO', () => {
    const ok = { user, session: { token: 'tok', expiresAt: '2026-11-03T10:00:00.000Z' } };
    expect(parseAuthResponse(ok)).toEqual(ok);
    expect(() => parseAuthResponse(null)).toThrow(TypeError);
    expect(() => parseAuthResponse({ session: ok.session })).toThrow(TypeError);
    expect(() => parseAuthResponse({ ...ok, user: { ...user, role: 1 } })).toThrow(TypeError);
    expect(() => parseAuthResponse({ user })).toThrow(TypeError);
    expect(() => parseAuthResponse({ ...ok, session: { ...ok.session, token: '' } })).toThrow(TypeError);
    expect(() => parseAuthResponse({ ...ok, session: { ...ok.session, token: 5 } })).toThrow(TypeError);
    expect(() => parseAuthResponse({ ...ok, session: { ...ok.session, expiresAt: 'ontem' } })).toThrow(TypeError);
    expect(() => parseAuthResponse({ ...ok, session: { token: 'tok' } })).toThrow(TypeError);
  });

  it('mes inicial: { currentMonth, month, advance }', () => {
    const ok = { currentMonth: '2026-11', month: '2026-12', advance: 'NEXT_PENDING' };
    expect(parseInitialMonth(ok)).toEqual(ok);
    expect(() => parseInitialMonth({ ...ok, advance: 'X' })).toThrow(TypeError);
    expect(() => parseInitialMonth({ ...ok, month: 202612 })).toThrow(TypeError);
    expect(() => parseInitialMonth({ ...ok, currentMonth: 'nov' })).toThrow(TypeError);
    expect(() => parseInitialMonth(null)).toThrow(TypeError);
  });
});
