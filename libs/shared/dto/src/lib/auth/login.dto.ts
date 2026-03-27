import {z} from "zod";
import {RegisterSchema} from "./register.dto";


export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1,"Password is required"),
});

export type LoginDto = z.infer<typeof LoginSchema>;
