import { z } from 'zod';

export const ReceiptFilterSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
});

export type ReceiptFilterDto = z.infer<typeof ReceiptFilterSchema>;
