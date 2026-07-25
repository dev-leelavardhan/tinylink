import { z } from 'zod';

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
