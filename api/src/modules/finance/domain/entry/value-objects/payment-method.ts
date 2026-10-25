import { err, ok, type Result } from '@shared/domain/result.js';

export type PaymentMethod = 'PIX' | 'CARD';

export function parsePaymentMethod(raw: string): Result<PaymentMethod, 'INVALID_VALUE'> {
  return raw === 'PIX' || raw === 'CARD' ? ok(raw) : err('INVALID_VALUE');
}
