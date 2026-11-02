// Lista das regras puras sincronizadas: fonte da verdade em web/lib, copia byte a byte em mobile/src/lib (ADR 0011 10.3).
export const SHARED_FILES = [
  'money/decimal.ts',
  'dates/format.ts',
  'entries/form.ts',
  'entries/installments.ts',
  'entries/payment-feedback.ts',
  'dashboard/chart-data.ts',
  'api/types.ts',
  // specs correspondentes (ADR 0011 10.3)
  'entries/form.spec.ts',
  'dashboard/chart-data.spec.ts',
  'entries/payment-feedback.spec.ts',
  'dates/format.spec.ts',
  'money/decimal.spec.ts',
];
