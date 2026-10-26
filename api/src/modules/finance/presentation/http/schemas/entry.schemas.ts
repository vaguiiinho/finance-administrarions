import { z } from 'zod';

/** Corpo de E1 (strict): `status`, `referenceMonth`, datas da fatura etc. caem em UNKNOWN_FIELD. */
export const createEntryBodySchema = z.strictObject({
  type: z.string(),
  description: z.string(),
  category: z.string(),
  date: z.string(),
  amount: z.string(),
  paymentMethod: z.string(),
  cardId: z.string().nullable().optional(),
  paid: z.boolean().optional(),
});

export type CreateEntryBody = z.infer<typeof createEntryBodySchema>;

/** Corpo de E5 (strict). Tamanho do array: 1..100 itens na lista bruta. */
export const payBatchBodySchema = z.strictObject({
  ids: z.array(z.string()).min(1).max(100),
});

export type PayBatchBody = z.infer<typeof payBatchBodySchema>;
