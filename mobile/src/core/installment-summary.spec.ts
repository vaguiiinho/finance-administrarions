import { summarizeInstallments } from '@/core/installment-summary';

const NBSP = ' ';
const p = (amounts: string[]) => amounts.map((amount, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-10`, amount }));

describe('summarizeInstallments', () => {
  it('previa vazia -> texto vazio', () => expect(summarizeInstallments([])).toBe(''));
  it('uma unica parcela', () => expect(summarizeInstallments(p(['10.00']))).toBe(`1 × R$${NBSP}10,00`));
  it('todas iguais agrupam em um valor', () => expect(summarizeInstallments(p(Array(6).fill('50.00')))).toBe(`6 × R$${NBSP}50,00`));
  it('resto nas primeiras parcelas: dois grupos', () =>
    expect(summarizeInstallments(p(['58.34', '58.34', '58.33', '58.33', '58.33', '58.33']))).toBe(
      `2 × R$${NBSP}58,34 e 4 × R$${NBSP}58,33`,
    ));
  it('so agrupa valores consecutivos', () =>
    expect(summarizeInstallments(p(['1.00', '2.00', '1.00']))).toBe(`1 × R$${NBSP}1,00 e 1 × R$${NBSP}2,00 e 1 × R$${NBSP}1,00`));
  it('formata milhares', () => expect(summarizeInstallments(p(['1234.50', '1234.50']))).toBe(`2 × R$${NBSP}1.234,50`));
  it('nao altera a previa recebida', () => {
    const preview = p(['1.00', '1.00']);
    const copy = JSON.parse(JSON.stringify(preview));
    summarizeInstallments(preview);
    expect(preview).toEqual(copy);
  });
});
