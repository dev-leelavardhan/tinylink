import { z } from 'zod';

export const verifyEmailSchema = z.object({
  userId: z.string().cuid(),
  otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;
