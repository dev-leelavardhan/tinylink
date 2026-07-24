import { z } from 'zod';

import { USER_CONSTANTS } from '../constants/user.constants';

export const registerUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(
      USER_CONSTANTS.MIN_PASSWORD_LENGTH,
      'Password must be at least 8 characters',
    )
    .max(
      USER_CONSTANTS.MAX_PASSWORD_LENGTH,
      'Password must be at most 128 characters',
    ),
});

export type RegisterUserDto = z.infer<typeof registerUserSchema>;
