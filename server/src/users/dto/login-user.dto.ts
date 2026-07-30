import { z } from 'zod';

export const loginUserSchema = z.object({
  email: z.string().email('Invalid email format').max(256),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginUserDto = z.infer<typeof loginUserSchema>;
