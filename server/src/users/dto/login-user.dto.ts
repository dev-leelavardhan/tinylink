import { z } from 'zod';

export const loginUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginUserDto = z.infer<typeof loginUserSchema>;
