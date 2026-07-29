import { z } from 'zod';
import {
  MAX_ALIAS_LENGTH,
  MIN_ALIAS_LENGTH,
} from '../constants/alias.constants';

export const createUrlSchema = z.object({
  originalUrl: z
    .url()
    .max(2048, 'URL must be at most 2048 characters')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must use HTTP or HTTPS',
    ),
  customAlias: z
    .string()
    .trim()
    .toLowerCase()
    .min(MIN_ALIAS_LENGTH)
    .max(MAX_ALIAS_LENGTH)
    .optional(),
  expiresAt: z.coerce
    .date()
    .refine((date) => date > new Date(), {
      error: 'Expiration date must be in the future',
    })
    .optional(),
});

export type CreateUrlDto = z.infer<typeof createUrlSchema>;
