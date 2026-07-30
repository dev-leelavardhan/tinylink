import { z } from 'zod';

import { USER_CONSTANTS } from '../constants/user.constants';

const passwordRegex = [
  { pattern: /(?=.*[a-z])/, message: 'at least one lowercase letter' },
  { pattern: /(?=.*[A-Z])/, message: 'at least one uppercase letter' },
  { pattern: /(?=.*\d)/, message: 'at least one number' },
  {
    pattern: /(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
    message: 'at least one special character',
  },
];

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(
      USER_CONSTANTS.MIN_PASSWORD_LENGTH,
      'Password must be at least 8 characters',
    )
    .max(
      USER_CONSTANTS.MAX_PASSWORD_LENGTH,
      'Password must be at most 128 characters',
    )
    .refine(
      (val) => passwordRegex.every(({ pattern }) => pattern.test(val)),
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
