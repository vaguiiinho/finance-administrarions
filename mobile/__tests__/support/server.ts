import { setupServer } from 'msw/node';

export const API = 'https://api.test';
export const server = setupServer();
export const calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
export const callsTo = (method: string, path: RegExp | string) =>
  calls.filter((c) => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path)));

export const ME = {
  id: 'u1', name: 'Ana Souza', email: 'ana@exemplo.com', role: 'USER', mustChangePassword: false, accountKind: 'REGULAR',
  capabilities: ['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'UPDATE_OWN_PROFILE'],
};
export const DEMO_ME = { ...ME, id: 'd2', name: 'Conta de demonstração', email: 'demo@showcase.invalid', accountKind: 'SHOWCASE', capabilities: ['MANAGE_EXPENSES'] };

/** Corpo real de GET /api/summary (docs/api/finance.md): { month, totals }. */
export const SUMMARY = { month: '2026-11', totals: { income: '0.00', expenses: { total: '0.00', paid: '0.00', pending: '0.00' }, balance: { realized: '0.00', projected: '0.00' } } };
