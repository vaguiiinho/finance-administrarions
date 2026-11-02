import { previewInstallments } from '@/lib/entries/installments';

describe('previewInstallments (CA24, RF17)', () => {
  it('R$ 350,00 em 6x = 2 x 58,34 + 4 x 58,33, em centavos', () => {
    const p = previewInstallments('350.00', 6, '2027-01-31')!;
    expect(p.map((i) => i.amount)).toEqual(['58.34', '58.34', '58.33', '58.33', '58.33', '58.33']);
  });
  it('31/01 -> 28/02/2027 na 2a parcela', () => {
    expect(previewInstallments('350.00', 6, '2027-01-31')![1].date).toBe('2027-02-28');
  });
});
