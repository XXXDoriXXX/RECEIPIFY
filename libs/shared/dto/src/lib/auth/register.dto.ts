import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  fullName: z.string().min(2).max(120),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
