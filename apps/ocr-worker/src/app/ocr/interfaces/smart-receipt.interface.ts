import { z } from 'zod';

export const SmartReceiptSchema = z.object({
  merchant: z.object({
    name: z.string(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    country_code: z.string().nullable(),
  }),
  receipt: z.object({
    totalAmount: z.number(),
    currencyCode: z.string(),
    purchaseDate: z.string(),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      quantity: z.number(),
      suggestedCategory: z.enum(['Groceries', 'Electronics', 'Restaurant', 'Transport', 'Other']),
    })
  ),
  rawText: z.string().optional(),
});

export type SmartReceiptResult = z.infer<typeof SmartReceiptSchema>;
