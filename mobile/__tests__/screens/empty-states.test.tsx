import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { server, callsTo, ME, DEMO_ME } from '../support/server';
import { apiError, get, json, renderApp, signedIn } from '../support/render-app';

const month = get('/api/entries/initial-month', () => json({ currentMonth: '2026-11', month: '2026-11', advance: 'NONE' }));
const empty = { month: '2026-11', items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, subtotal: { total: '0.00', paid: '0.00', pending: '0.00' } };
const dash = [get('/api/summary', () => json({ month: '2026-11', totals: { income: '0.00', expenses: { total: '0.00', paid: '0.00', pending: '0.00' }, balance: { realized: '0.00', projected: '0.00' } } })),
  get('/api/dashboard/monthly-series', () => json({ from: '2026-06', to: '2026-11', points: [] })), get('/api/dashboard/category-distribution', () => json({ month: '2026-11', total: '0.00', items: [] }))];

describe('estados vazios e de erro (RF14, CA20, ADR 0011 10.13)', () => {
  it('aba Despesas sem itens: "Nenhuma despesa em novembro de 2026."', async () => {
    signedIn(ME, month, get('/api/entries/expenses', () => json(empty)), get('/api/categories', () => json({ items: ['x'] })), get('/api/cards', () => json({ items: [] })));
    renderApp('/finances');
    expect(await screen.findByText('Nenhuma despesa em novembro de 2026.')).toBeOnTheScreen();
  });

  it('CA20: Receitas com 500 mostra erro com "Tentar novamente", que refaz a leitura', async () => {
    signedIn(ME, month, get('/api/entries/incomes', () => apiError(500, 'INTERNAL_ERROR')), get('/api/categories', () => json({ items: ['x'] })));
    renderApp('/finances?tab=incomes');
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(callsTo('GET', /entries\/incomes/).length).toBeGreaterThan(1));
  });

  it('conta sem dados (categories = []): Dashboard mostra o card de boas-vindas', async () => {
    signedIn(DEMO_ME, get('/api/categories', () => json({ items: [] })), get('/api/cards', () => json({ items: [] })), ...dash);
    renderApp('/dashboard');
    expect(await screen.findByTestId('welcome-card')).toBeOnTheScreen();
  });

  it('com categorias, o layout normal (sem card de boas-vindas)', async () => {
    signedIn(ME, get('/api/categories', () => json({ items: ['Moradia'] })), ...dash);
    renderApp('/dashboard');
    await screen.findByText('Saldo previsto');
    expect(screen.queryByTestId('welcome-card')).toBeNull();
  });

  it('categorias em erro: layout normal (sinal indefinido)', async () => {
    signedIn(ME, get('/api/categories', () => apiError(500, 'INTERNAL_ERROR')), ...dash);
    renderApp('/dashboard');
    await screen.findByText('Saldo previsto');
    expect(screen.queryByTestId('welcome-card')).toBeNull();
  });

  it('CA14: erro isolado na serie; resumo e categorias seguem', async () => {
    signedIn(ME, get('/api/categories', () => json({ items: ['x'] })), get('/api/summary', () => json({ month: '2026-11', totals: { income: '5000.00', expenses: { total: '600.00', paid: '100.00', pending: '500.00' }, balance: { realized: '4900.00', projected: '4400.00' } } })),
      get('/api/dashboard/monthly-series', () => apiError(500, 'INTERNAL_ERROR')), get('/api/dashboard/category-distribution', () => json({ month: '2026-11', total: '0.00', items: [] })));
    renderApp('/dashboard');
    expect(await screen.findByText('Não foi possível carregar a evolução mensal.')).toBeOnTheScreen();
    expect(screen.getByText(/R\$\s?4\.400,00/)).toBeOnTheScreen();
  });

  it('CA14: serie malformada (items no lugar de points) vira erro de bloco; resumo segue', async () => {
    signedIn(ME, get('/api/categories', () => json({ items: ['x'] })), get('/api/summary', () => json({ month: '2026-11', totals: { income: '5000.00', expenses: { total: '600.00', paid: '100.00', pending: '500.00' }, balance: { realized: '4900.00', projected: '4400.00' } } })),
      get('/api/dashboard/monthly-series', () => json({ from: '2026-06', to: '2026-11', items: [] })), get('/api/dashboard/category-distribution', () => json({ month: '2026-11', total: '0.00', items: [] })));
    renderApp('/dashboard');
    expect(await screen.findByText('Não foi possível carregar a evolução mensal.')).toBeOnTheScreen();
    expect(screen.getByText(/R\$\s?4\.400,00/)).toBeOnTheScreen();
  });

  it('resposta malformada em Despesas (sem subtotal) mostra erro com "Tentar novamente"', async () => {
    signedIn(ME, month, get('/api/entries/expenses', () => json({ month: '2026-11', items: [], pagination: empty.pagination })), get('/api/categories', () => json({ items: ['x'] })), get('/api/cards', () => json({ items: [] })));
    renderApp('/finances');
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
  });

  it('CA12: saldo previsto negativo "-R$ 150,00" com o indicador textual "Negativo"', async () => {
    signedIn(ME, get('/api/categories', () => json({ items: ['x'] })), get('/api/summary', () => json({ month: '2026-11', totals: { income: '0.00', expenses: { total: '150.00', paid: '0.00', pending: '150.00' }, balance: { realized: '0.00', projected: '-150.00' } } })),
      get('/api/dashboard/monthly-series', () => json({ from: '2026-06', to: '2026-11', points: [] })), get('/api/dashboard/category-distribution', () => json({ month: '2026-11', total: '0.00', items: [] })));
    renderApp('/dashboard');
    expect(await screen.findByText(/-R\$\s?150,00/)).toBeOnTheScreen();
    expect(screen.getByText('Negativo')).toBeOnTheScreen();
  });
});
