import { z } from 'zod';

/** Forma do corpo de C1/C3 (strict). Faixa dos dias (1-31, inteiro) é regra do domínio. */
export const cardBodySchema = z.strictObject({
  name: z.string(),
  closingDay: z.number(),
  dueDay: z.number(),
});

export type CardBody = z.infer<typeof cardBodySchema>;
