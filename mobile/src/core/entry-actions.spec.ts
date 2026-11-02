import { entryActions } from '@/core/entry-actions';

const exp = (status: 'PENDING' | 'PAID') => ({ type: 'EXPENSE', status });
const income = { type: 'INCOME', status: 'RECEIVED' };

describe('acoes visiveis por linha (B6, DM12, RF29)', () => {
  it('despesa pendente com MANAGE_EXPENSES: pagar, editar, excluir', () =>
    expect(entryActions(exp('PENDING') as never, ['MANAGE_EXPENSES'])).toEqual({ pay: true, edit: true, remove: true }));
  it('despesa paga: nao paga; edita e exclui', () =>
    expect(entryActions(exp('PAID') as never, ['MANAGE_EXPENSES'])).toEqual({ pay: false, edit: true, remove: true }));
  it('sem MANAGE_EXPENSES: so pagar', () => expect(entryActions(exp('PENDING') as never, [])).toEqual({ pay: true, edit: false, remove: false }));
  it('receita nunca tem acao', () => expect(entryActions(income as never, ['MANAGE_EXPENSES'])).toEqual({ pay: false, edit: false, remove: false }));
});
