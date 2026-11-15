import { describeError } from './demo-account-reset.routine.js';

/** describeError: so codigo ou nome, nunca a mensagem (RF19, ADR 0013 5.5). */
describe('describeError', () => {
  it('usa o codigo (Prisma/SQLSTATE) quando existe', () => {
    expect(describeError(Object.assign(new Error('valor secreto'), { code: 'P2002' }))).toBe('P2002');
  });
  it('sem codigo, usa o nome do erro', () => {
    expect(describeError(new TypeError('valor secreto'))).toBe('TypeError');
  });
  it('valor que nao e Error -> UnknownError', () => {
    expect(describeError('texto')).toBe('UnknownError');
    expect(describeError(null)).toBe('UnknownError');
  });
});
