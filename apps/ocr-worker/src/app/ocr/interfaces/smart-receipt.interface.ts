import { z } from 'zod';

export const SmartReceiptSchema = z.object({
  merchant: z.object({
    name: z.string(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country_code: z.string().nullable().optional(),
  }),
  receipt: z.object({
    title: z.string().nullable().optional(),
    totalAmount: z.number(),
    currencyCode: z.string(),
    purchaseDate: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      quantity: z.number().optional().default(1),
      unit: z.string().nullable().optional(),
      suggestedCategory: z.string().optional(),
    })
  ),
  rawText: z.string().nullable().optional(),
});

export type SmartReceiptResult = z.infer<typeof SmartReceiptSchema>;
