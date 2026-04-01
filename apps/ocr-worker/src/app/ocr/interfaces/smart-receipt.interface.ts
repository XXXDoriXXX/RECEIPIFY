import { z } from 'zod';

export const SmartReceiptSchema = z.object({
  merchant: z.object({
    name: z.string(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    country_code: z.string().nullable(),
  }),
  receipt: z.object({
    title: z.string().nullable(),
    totalAmount: z.number(),
    currencyCode: z.string(),
    purchaseDate: z.string(),
    notes: z.string().nullable(),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      quantity: z.number(),
      unit: z.string().nullable(),
      suggestedCategory: z.string(),
    })
  ),
  rawText: z.string().optional(),
});

export type SmartReceiptResult = z.infer<typeof SmartReceiptSchema>;
