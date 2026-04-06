import { z } from 'zod';

export const AnalyticsFilterSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year', 'all']).default('month'),
});

export type AnalyticsFilterDto = z.infer<typeof AnalyticsFilterSchema>;
