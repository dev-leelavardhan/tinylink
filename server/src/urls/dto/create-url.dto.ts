import { z } from 'zod';

export const createUrlSchema = z.object({
  originalUrl: z
    .url()
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must use HTTP or HTTPS',
    ),
});

export type CreateUrlDto = z.infer<typeof createUrlSchema>;
