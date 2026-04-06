import { z } from 'zod';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  currencyCode: z.string().length(3).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
