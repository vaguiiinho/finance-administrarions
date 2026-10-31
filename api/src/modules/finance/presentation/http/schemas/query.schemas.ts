import { z } from 'zod';

/** Queries estritas: parâmetro desconhecido -> UNKNOWN_FIELD; repetido -> INVALID_TYPE. */
export const monthQuerySchema = z.strictObject({ month: z.string() });

export const invoicesQuerySchema = z.strictObject({ month: z.string(), status: z.string().optional() });

/** Rotas sem query: qualquer parâmetro é UNKNOWN_FIELD. */
export const noQuerySchema = z.strictObject({});

export const expensesQuerySchema = z.strictObject({
  month: z.string(),
  status: z.string().optional(),
  category: z.string().optional(),
  cardId: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const incomesQuerySchema = z.strictObject({
  month: z.string(),
  category: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type InvoicesQuery = z.infer<typeof invoicesQuerySchema>;
export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;
export type IncomesQuery = z.infer<typeof incomesQuerySchema>;
