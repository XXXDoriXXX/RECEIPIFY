import { z } from 'zod';

export const CreateReceiptSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  totalAmount: z.number().positive(),
  currencyCode: z.string().length(3).default('USD'),
  purchaseDate: z.string().datetime(),
  merchantName: z.string().min(1).max(200),
  categoryName: z.string().min(1).max(80),
  items: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    quantity: z.number().int().default(1),
    unit: z.string().optional(),
  })).optional(),
});

export type CreateReceiptDto = z.infer<typeof CreateReceiptSchema>;
