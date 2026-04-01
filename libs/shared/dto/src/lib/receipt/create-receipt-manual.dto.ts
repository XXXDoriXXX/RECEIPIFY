import { z } from 'zod';

export const CreateReceiptManualSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  totalAmount: z.number().positive(),
  currencyCode: z.string().length(3).default('USD'),
  purchaseDate: z.string().datetime(),
  merchantName: z.string().min(1).max(200),
  notes: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    amount: z.number().positive(),
    quantity: z.number().int().min(1).default(1),
    categoryId: z.string().uuid(),
  })).min(1),
});

export type CreateReceiptManualDto = z.infer<typeof CreateReceiptManualSchema>;
