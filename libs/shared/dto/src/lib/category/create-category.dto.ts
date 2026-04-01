import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  iconSlug: z.string().max(50).optional(),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
