import { z } from 'zod';

/** Queries estritas: parâmetro desconhecido -> UNKNOWN_FIELD; repetido -> INVALID_TYPE. */
export const monthQuerySchema = z.strictObject({ month: z.string() });

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
export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;
export type IncomesQuery = z.infer<typeof incomesQuerySchema>;
