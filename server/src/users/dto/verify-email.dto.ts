import { z } from 'zod';

export const verifyEmailSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;
