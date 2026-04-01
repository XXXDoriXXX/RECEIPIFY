import { z } from 'zod';

export const UpdateReceiptSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  totalAmount: z.number().positive().optional(),
  currencyCode: z.string().length(3).optional(),
  purchaseDate: z.string().datetime().optional(),
  merchantName: z.string().min(1).max(200).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    amount: z.number().positive(),
    quantity: z.number().int().min(1).default(1),
    categoryId: z.string().uuid(),
  })).optional(),
});

export type UpdateReceiptDto = z.infer<typeof UpdateReceiptSchema>;
