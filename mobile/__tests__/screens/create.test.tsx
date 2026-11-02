import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { server, callsTo, ME } from '../support/server';
import { apiError, get, json, post, renderApp, signedIn } from '../support/render-app';

const NUBANK = { id: 'c1', name: 'Nubank', closingDay: 25, dueDay: 5 };
const base = (cards: unknown[] = [NUBANK]) => {
  signedIn(ME, get('/api/cards', () => json({ items: cards })), get('/api/categories', () => json({ items: ['Moradia'] })));
};
const type = async (label: string, text: string) => {
  const u = userEvent.setup();
  const f = await screen.findByLabelText(label);
  await u.clear(f);
  await u.type(f, text);
  return u;
};
const save = async () => userEvent.setup().press(screen.getByRole('button', { name: 'Salvar' }));

describe('Nova despesa (CA21-CA23, CA26-CA28)', () => {
  it('CA21: PIX pago envia o payload exato, sem paid, e mostra "Despesa criada."', async () => {
    base();
    server.use(post('/api/entries', () => json({ id: 'e1' }, 201)));
    renderApp('/new/expense');
    await type('Descrição', 'Aluguel');
    await type('Categoria', 'Moradia');
    await type('Valor', '1.500,00');
    await save();
    expect(await screen.findByText('Despesa criada.')).toBeOnTheScreen();
    expect(callsTo('POST', '/api/entries')[0].body).toMatchObject({ type: 'EXPENSE', description: 'Aluguel', category: 'Moradia', amount: '1500.00', paymentMethod: 'PIX' });
    expect(callsTo('POST', '/api/entries')[0].body).not.toHaveProperty('paid');
    expect(callsTo('POST', '/api/entries')[0].body).not.toHaveProperty('status');
  });

  it('CA22: "Ainda nao paguei" envia paid:false; no cartao envia cardId e nao mostra "Ainda nao paguei"', async () => {
    base();
    server.use(post('/api/entries', () => json({ id: 'e1' }, 201)));
    renderApp('/new/expense');
    const u = await type('Descrição', 'Cinema');
    await type('Categoria', 'Lazer');
    await type('Valor', '60');
    await u.press(screen.getByLabelText('Ainda não paguei'));
    await save();
    await waitFor(() => expect(callsTo('POST', '/api/entries')[0].body).toMatchObject({ paid: false }));
    await u.press(await screen.findByRole('button', { name: 'Cartão' }));
    expect(screen.queryByLabelText('Ainda não paguei')).toBeNull();
  });

  it('CA23: "1234,5" vai como "1234.50"; "0,00" e "10.000.000.000,00" sao barrados sem chamar a API', async () => {
    base();
    server.use(post('/api/entries', () => json({ id: 'e1' }, 201)));
    renderApp('/new/expense');
    await type('Descrição', 'X');
    await type('Categoria', 'Y');
    expect((await screen.findByLabelText('Valor')).props.keyboardType).toBe('decimal-pad');
    await type('Valor', '0,00');
    await save();
    expect(await screen.findByText('Informe um valor maior que zero.')).toBeOnTheScreen();
    await type('Valor', '10.000.000.000,00');
    await save();
    expect(await screen.findByText('O valor máximo é R$ 9.999.999.999,99.')).toBeOnTheScreen();
    expect(callsTo('POST', '/api/entries')).toHaveLength(0);
    await type('Valor', '1234,5');
    await save();
    await waitFor(() => expect(callsTo('POST', '/api/entries')[0].body).toMatchObject({ amount: '1234.50' }));
  });

  it('CA26: 400 por campo aparece na Categoria; campos mantidos; nada anunciado como criado', async () => {
    base();
    server.use(post('/api/entries', () => apiError(400, 'VALIDATION_ERROR', { fields: [{ field: 'category', code: 'TOO_LONG' }] })));
    renderApp('/new/expense');
    await type('Descrição', 'Aluguel');
    await type('Categoria', 'Moradia');
    await type('Valor', '10');
    await save();
    expect(await screen.findByText(/longo demais|Máximo/i)).toBeOnTheScreen();
    expect(screen.getByLabelText('Descrição').props.value).toBe('Aluguel');
    expect(screen.queryByText('Despesa criada.')).toBeNull();
  });

  it('CA26: 404 CARD_NOT_FOUND mostra a mensagem e recarrega os cartoes', async () => {
    base();
    server.use(post('/api/entries', () => apiError(404, 'CARD_NOT_FOUND')));
    renderApp('/new/expense');
    await type('Descrição', 'Compra');
    await type('Categoria', 'Lazer');
    await type('Valor', '10');
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Cartão' }));
    await save();
    expect(await screen.findByText('O cartão escolhido não existe mais.')).toBeOnTheScreen();
    await waitFor(() => expect(callsTo('GET', '/api/cards').length).toBeGreaterThan(1));
  });

  it('CA26: rede caiu -> mensagem de conexao, nada criado', async () => {
    base();
    server.use(post('/api/entries', () => Response.error()));
    renderApp('/new/expense');
    await type('Descrição', 'A');
    await type('Categoria', 'B');
    await type('Valor', '10');
    await save();
    expect(await screen.findByText('Sem conexão. Verifique sua internet.')).toBeOnTheScreen();
    expect(screen.queryByText('Despesa criada.')).toBeNull();
  });

  it('CA27: dois toques rapidos em Salvar enviam uma unica requisicao', async () => {
    base();
    server.use(post('/api/entries', () => json({ id: 'e1' }, 201)));
    renderApp('/new/expense');
    await type('Descrição', 'A');
    await type('Categoria', 'B');
    await type('Valor', '10');
    const u = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Salvar' });
    await Promise.all([u.press(button), u.press(button)]);
    await waitFor(() => expect(callsTo('POST', '/api/entries')).toHaveLength(1));
  });

  it('CA28: sem cartoes, a opcao Cartao fica desabilitada com o texto do site', async () => {
    base([]);
    renderApp('/new/expense');
    expect(await screen.findByText('Cadastre um cartão no site para usar esta opção.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cartão' })).toBeDisabled();
  });
});

describe('Despesa parcelada (CA24) e Receita (CA25)', () => {
  it('CA24: previa "2 × R$ 58,34 e 4 × R$ 58,33", envia amount total e installments, mostra "6 parcelas criadas."', async () => {
    base();
    server.use(post('/api/entries/installments', () => json({ items: [] }, 201)));
    renderApp('/new/installments');
    await type('Descrição', 'Notebook');
    await type('Categoria', 'Tecnologia');
    await type('Valor total', '350,00');
    await type('Parcelas', '6');
    expect(await screen.findByText(/2 × R\$ 58,34 e 4 × R\$ 58,33/)).toBeOnTheScreen();
    expect(screen.getByText(/todas nascem pendentes/i)).toBeOnTheScreen();
    await save();
    expect(await screen.findByText('6 parcelas criadas.')).toBeOnTheScreen();
    expect(callsTo('POST', '/api/entries/installments')[0].body).toMatchObject({ amount: '350.00', installments: 6, paymentMethod: 'PIX' });
  });

  it('CA24: parcelas fora de 2-36 sao barradas antes do envio', async () => {
    base();
    renderApp('/new/installments');
    await type('Descrição', 'N');
    await type('Categoria', 'T');
    await type('Valor total', '100');
    await type('Parcelas', '37');
    await save();
    expect(callsTo('POST', '/api/entries/installments')).toHaveLength(0);
  });

  it('CA25: receita envia INCOME/PIX sem cardId nem paid e nao oferece forma de pagamento', async () => {
    base();
    server.use(post('/api/entries', () => json({ id: 'r1' }, 201)));
    renderApp('/new/income');
    await type('Descrição', 'Salário');
    await type('Categoria', 'Trabalho');
    await type('Valor', '5.000,00');
    expect(screen.queryByRole('button', { name: 'Cartão' })).toBeNull();
    expect(screen.queryByLabelText('Ainda não paguei')).toBeNull();
    await save();
    expect(await screen.findByText('Receita criada.')).toBeOnTheScreen();
    const body = callsTo('POST', '/api/entries')[0].body as object;
    expect(body).toMatchObject({ type: 'INCOME', paymentMethod: 'PIX', amount: '5000.00' });
    expect(body).not.toHaveProperty('cardId');
    expect(body).not.toHaveProperty('paid');
  });
});
