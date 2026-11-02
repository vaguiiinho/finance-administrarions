import { screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { act } from 'react';
import { server, callsTo, ME, DEMO_ME } from '../support/server';
import { apiError, get, json, post, renderApp, signedIn } from '../support/render-app';
import { http, HttpResponse } from 'msw';
import { API } from '../support/server';

const exp = (id: string, description: string, amount: string, status: 'PENDING' | 'PAID' = 'PENDING', extra: object = {}) => ({
  id, type: 'EXPENSE', description, category: 'Casa', date: '2026-11-05', amount, paymentMethod: 'PIX', card: null, invoice: null,
  status, paidAt: status === 'PAID' ? '2026-11-06T15:00:00Z' : null, ...extra,
});
const page = (items: unknown[]) => json({ month: '2026-11', items, pagination: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 }, subtotal: { total: '0.00', paid: '0.00', pending: '0.00' } });
const list = (items: unknown[], me: object = ME) =>
  signedIn(me, get('/api/entries/initial-month', () => json({ currentMonth: '2026-11', month: '2026-11', advance: 'NONE' })),
    get('/api/entries/expenses', () => page(items)), get('/api/categories', () => json({ items: ['Casa'] })), get('/api/cards', () => json({ items: [] })));
const u = () => userEvent.setup();

describe('Marcar como pago (CA34-CA36, RF26)', () => {
  it('toque no circulo de status + confirmar chama POST /pay uma vez e mostra paidFeedback', async () => {
    list([exp('e1', 'Internet', '120.00')]);
    server.use(post('/api/entries/e1/pay', () => json(exp('e1', 'Internet', '120.00', 'PAID'))));
    renderApp('/finances');
    await u().press(await screen.findByLabelText('Marcar como pago: Internet'));
    expect(screen.getByText(/Internet/)).toBeOnTheScreen();
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(callsTo('POST', '/api/entries/e1/pay')).toHaveLength(1));
    expect(await screen.findByText(/marcada como paga|marcado como pago|paga\./i)).toBeOnTheScreen();
    expect(screen.queryByText('Desfazer')).toBeNull();
  });

  it('cancelar a confirmacao nao faz requisicao', async () => {
    list([exp('e1', 'Internet', '120.00')]);
    renderApp('/finances');
    await u().press(await screen.findByLabelText('Marcar como pago: Internet'));
    await u().press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(callsTo('POST', /\/pay$/)).toHaveLength(0);
  });

  it('CA35: 404 mostra "Esta despesa nao foi encontrada. A lista foi atualizada." e recarrega', async () => {
    list([exp('e1', 'Internet', '120.00')]);
    server.use(post('/api/entries/e1/pay', () => apiError(404, 'ENTRY_NOT_FOUND')));
    renderApp('/finances');
    await u().press(await screen.findByLabelText('Marcar como pago: Internet'));
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Esta despesa não foi encontrada. A lista foi atualizada.')).toBeOnTheScreen();
    await waitFor(() => expect(callsTo('GET', /entries\/expenses/).length).toBeGreaterThan(1));
  });

  it('rede/5xx: mensagem sem falso sucesso', async () => {
    list([exp('e1', 'Internet', '120.00')]);
    server.use(post('/api/entries/e1/pay', () => apiError(500, 'INTERNAL_ERROR')));
    renderApp('/finances');
    await u().press(await screen.findByLabelText('Marcar como pago: Internet'));
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente.')).toBeOnTheScreen();
  });

  it('despesa paga nao oferece a acao e mostra "Pago em dd/mm/aaaa" (instante em Sao Paulo)', async () => {
    list([exp('e2', 'Luz', '80.00', 'PAID')]);
    renderApp('/finances?status=ALL');
    expect(await screen.findByText(/Pago em 06\/11\/2026/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Marcar como pago: Luz')).toBeNull();
  });
});

describe('Pagar em lote (CA57, RF37, DM16)', () => {
  it('seleciona 3 pendentes, barra mostra R$ 270,00, envia ids uma vez; a paga nao e selecionavel', async () => {
    list([exp('a', 'Água', '80.00'), exp('l', 'Luz', '150.00'), exp('g', 'Gás', '40.00'), exp('p', 'Cinema', '60.00', 'PAID')]);
    server.use(post('/api/entries/pay', () => json({ paidIds: ['a', 'l', 'g'], alreadyPaidIds: [] })));
    renderApp('/finances?status=ALL');
    await u().press(await screen.findByRole('button', { name: 'Selecionar' }));
    for (const d of ['Água', 'Luz', 'Gás']) await u().press(screen.getByLabelText(`Selecionar: ${d}`));
    expect(screen.queryByLabelText('Selecionar: Cinema')).toBeNull();
    expect(screen.getByText(/R\$\s?270,00/)).toBeOnTheScreen();
    await u().press(screen.getByRole('button', { name: 'Marcar como pago (3)' }));
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(callsTo('POST', '/api/entries/pay')).toHaveLength(1));
    expect(callsTo('POST', '/api/entries/pay')[0].body).toEqual({ ids: ['a', 'l', 'g'] });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Marcar como pago \(\d\)/ })).toBeNull());
  });

  it('404 ENTRIES_NOT_FOUND: nada pago, mensagem e recarga', async () => {
    list([exp('a', 'Água', '80.00')]);
    server.use(post('/api/entries/pay', () => apiError(404, 'ENTRIES_NOT_FOUND', { missingIds: ['a'] })));
    renderApp('/finances');
    await u().press(await screen.findByRole('button', { name: 'Selecionar' }));
    await u().press(screen.getByLabelText('Selecionar: Água'));
    await u().press(screen.getByRole('button', { name: 'Marcar como pago (1)' }));
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    await waitFor(() => expect(callsTo('GET', /entries\/expenses/).length).toBeGreaterThan(1));
  });

  it('mais de 100 itens e barrado antes do envio', async () => {
    list(Array.from({ length: 101 }, (_, i) => exp(`i${i}`, `Item ${i}`, '1.00')));
    renderApp('/finances');
    await u().press(await screen.findByRole('button', { name: 'Selecionar' }));
    await u().press(screen.getByRole('button', { name: /Selecionar todas/i }));
    await u().press(screen.getByRole('button', { name: /Marcar como pago/ }));
    expect(callsTo('POST', '/api/entries/pay')).toHaveLength(0);
  });
});

describe('Pagar fatura (CA37, RF30)', () => {
  const invoice = { card: { id: 'c1', name: 'Nubank' }, referenceMonth: '2026-11', closingDate: '2026-11-10', dueDate: '2026-11-20', entryCount: 3, pendingCount: 2, totals: { total: '600.00', paid: '100.00', pending: '500.00' } };
  const inv = (pending: string) => signedIn(ME, get('/api/entries/initial-month', () => json({ currentMonth: '2026-11', month: '2026-11', advance: 'NONE' })),
    get('/api/invoices', () => json({ items: [{ ...invoice, totals: { ...invoice.totals, pending } }] })), get('/api/categories', () => json({ items: ['x'] })), get('/api/cards', () => json({ items: [] })));

  it('confirma com cartao/mes/valor e chama POST /cards/c1/invoices/2026-11/pay', async () => {
    inv('500.00');
    server.use(post('/api/cards/c1/invoices/2026-11/pay', () => json({ paidCount: 2, paidAmount: '500.00' })));
    renderApp('/finances?tab=invoices');
    await u().press(await screen.findByRole('button', { name: 'Pagar fatura' }));
    expect(screen.getByText(/Nubank/)).toBeOnTheScreen();
    expect(screen.getByText(/R\$\s?500,00/)).toBeOnTheScreen();
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(callsTo('POST', '/api/cards/c1/invoices/2026-11/pay')).toHaveLength(1));
  });
  it('fatura sem pendencias nao mostra "Pagar fatura"', async () => {
    inv('0.00');
    renderApp('/finances?tab=invoices');
    await screen.findByText('Nubank');
    expect(screen.queryByRole('button', { name: 'Pagar fatura' })).toBeNull();
  });
  it('404 CARD_NOT_FOUND: "Este cartao nao foi encontrado. Nada foi alterado."', async () => {
    inv('500.00');
    server.use(post('/api/cards/c1/invoices/2026-11/pay', () => apiError(404, 'CARD_NOT_FOUND')));
    renderApp('/finances?tab=invoices');
    await u().press(await screen.findByRole('button', { name: 'Pagar fatura' }));
    await u().press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Este cartão não foi encontrado. Nada foi alterado.')).toBeOnTheScreen();
  });
});

describe('Editar (CA38, CA39, CA56)', () => {
  const mercado = exp('m1', 'Mercado', '230.00', 'PENDING', { category: 'Alimentação', date: '2026-10-15' });
  it('USER edita valor e data: PUT so com os 4 campos; mostra "Despesa atualizada." com Desfazer', async () => {
    list([mercado]);
    server.use(http.put(`${API}/api/entries/m1`, () => HttpResponse.json({ ...mercado, amount: '230.50' })));
    renderApp('/edit/m1');
    const f = await screen.findByLabelText('Valor');
    const user = u();
    await user.clear(f);
    await user.type(f, '230,50');
    await user.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Despesa atualizada.')).toBeOnTheScreen();
    expect(callsTo('PUT', '/api/entries/m1')[0].body).toEqual({ description: 'Mercado', category: 'Alimentação', date: '2026-10-15', amount: '230.50' });
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen();
  });
  it('Desfazer reenvia o PUT com os valores anteriores', async () => {
    list([mercado]);
    server.use(http.put(`${API}/api/entries/m1`, () => HttpResponse.json(mercado)));
    renderApp('/edit/m1');
    const f = await screen.findByLabelText('Valor');
    await u().clear(f);
    await u().type(f, '230,50');
    await u().press(screen.getByRole('button', { name: 'Salvar' }));
    await u().press(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(callsTo('PUT', '/api/entries/m1')).toHaveLength(2));
    expect(callsTo('PUT', '/api/entries/m1')[1].body).toMatchObject({ amount: '230.00' });
  });
  it('CA39: despesa paga no cartao -> Data desabilitada com o texto; 422 aparece no campo Data', async () => {
    const paidCard = exp('k1', 'Compra', '50.00', 'PAID', { paymentMethod: 'CARD', card: { id: 'c1', name: 'Nubank' } });
    list([paidCard]);
    server.use(http.put(`${API}/api/entries/k1`, () => HttpResponse.json({ code: 'PAID_CARD_EXPENSE_DATE_LOCKED', message: 'x', details: {} }, { status: 422 })));
    renderApp('/edit/k1');
    expect(await screen.findByLabelText('Data')).toBeDisabled();
    expect(screen.getByText('A data de uma despesa paga no cartão não pode ser alterada.')).toBeOnTheScreen();
    await u().press(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.queryByText('Despesa atualizada.')).toBeNull();
  });
});

describe('Excluir com Desfazer (CA40, CA41, CA55)', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());
  const cinema = exp('c1', 'Cinema', '60.00', 'PAID');
  const open = async () => {
    list([cinema]);
    server.use(http.delete(`${API}/api/entries/c1`, () => new HttpResponse(null, { status: 204 })));
    renderApp('/finances?status=ALL');
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(await screen.findByLabelText('Excluir despesa: Cinema'));
    await user.press(screen.getByRole('button', { name: 'Excluir' }));
    return user;
  };
  it('item sai da lista; DELETE so depois dos 5 s, uma unica vez', async () => {
    await open();
    expect(await screen.findByText('Despesa excluída.')).toBeOnTheScreen();
    expect(screen.queryByText('Cinema')).toBeNull();
    expect(callsTo('DELETE', '/api/entries/c1')).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(5_000); });
    await waitFor(() => expect(callsTo('DELETE', '/api/entries/c1')).toHaveLength(1));
  });
  it('CA55: Desfazer devolve o item e nao envia DELETE', async () => {
    const user = await open();
    await user.press(await screen.findByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByText('Cinema')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(callsTo('DELETE', '/api/entries/c1')).toHaveLength(0);
  });
  it('cancelar a confirmacao nao envia nada', async () => {
    list([cinema]);
    renderApp('/finances?status=ALL');
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(await screen.findByLabelText('Excluir despesa: Cinema'));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(callsTo('DELETE', '/api/entries/c1')).toHaveLength(0);
  });
});

describe('Visibilidade das acoes (CA42, RF29, B6)', () => {
  it.each([['USER', ME], ['conta demo', DEMO_ME], ['ADMIN', { ...ME, role: 'ADMIN', capabilities: ['MANAGE_EXPENSES', 'MANAGE_USERS'] }]])('%s ve Marcar como pago, Editar e Excluir', async (_n, me) => {
    list([exp('e1', 'Internet', '120.00')], me);
    renderApp('/finances');
    expect(await screen.findByLabelText('Marcar como pago: Internet')).toBeOnTheScreen();
    expect(screen.getByLabelText('Editar despesa: Internet')).toBeOnTheScreen();
    expect(screen.getByLabelText('Excluir despesa: Internet')).toBeOnTheScreen();
  });
  it('sem MANAGE_EXPENSES (caso sintetico) so aparece pagar', async () => {
    list([exp('e1', 'Internet', '120.00')], { ...ME, capabilities: [] });
    renderApp('/finances');
    await screen.findByLabelText('Marcar como pago: Internet');
    expect(screen.queryByLabelText('Editar despesa: Internet')).toBeNull();
    expect(screen.queryByLabelText('Excluir despesa: Internet')).toBeNull();
  });
  it('receitas nao mostram nenhuma acao', async () => {
    signedIn(ME, get('/api/entries/initial-month', () => json({ currentMonth: '2026-11', month: '2026-11', advance: 'NONE' })),
      get('/api/entries/incomes', () => page([{ ...exp('r1', 'Salário', '5000.00', 'PAID'), type: 'INCOME', status: 'RECEIVED' }])), get('/api/categories', () => json({ items: ['x'] })));
    renderApp('/finances?tab=incomes');
    await screen.findByText('Salário');
    expect(screen.queryByLabelText(/Editar despesa|Excluir despesa|Marcar como pago/)).toBeNull();
  });
});
