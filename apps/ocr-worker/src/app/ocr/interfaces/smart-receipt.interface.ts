
import { z } from 'zod';

export const SmartReceiptSchema = z.object({
  _reasoning: z.string().optional(),
  _confidenceScore: z.number().min(0).max(1),
  merchant: z.object({
    name: z.string(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    countryCode: z.string().nullable(),
    taxId: z.string().nullable(),
  }),
  receipt: z.object({
    totalAmount: z.number(),
    subtotalAmount: z.number().nullable(),
    taxAmount: z.number().nullable(),
    discountAmount: z.number().nullable(),
    currencyCode: z.string(),
    purchaseDate: z.string(),
    paymentMethod: z.enum(['Cash', 'Card', 'Mobile']).nullable(),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      quantity: z.number(),
      unit: z.string().nullable(),
      unitPrice: z.number().nullable(),
      suggestedCategory: z.string(),
    })
  ),
  rawText: z.string().optional(),
}).refine((data) => {

  if (data.receipt.subtotalAmount != null && data.receipt.taxAmount != null) {
    const calculatedTotal = data.receipt.subtotalAmount + data.receipt.taxAmount - (data.receipt.discountAmount || 0);

    return Math.abs(calculatedTotal - data.receipt.totalAmount) < 0.05;
  }
  return true;
}, {
  message: "Receipt math reconciliation failed (Subtotal + Tax - Discount != Total)",
  path: ["receipt", "totalAmount"]
});

export type SmartReceiptResult = z.infer<typeof SmartReceiptSchema>;
