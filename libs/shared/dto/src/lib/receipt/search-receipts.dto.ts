import { z } from 'zod';
import { ReceiptStatus } from '@prisma/client';

export const SearchReceiptsSchema = z.object({
  query: z.string().optional(),
  status: z.nativeEnum(ReceiptStatus).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchReceiptsDto = z.infer<typeof SearchReceiptsSchema>;
