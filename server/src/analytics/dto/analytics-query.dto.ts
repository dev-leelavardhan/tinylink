import { z } from 'zod';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

export const analyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30),
});

export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ANALYTICS_CONSTANTS.MAX_PAGE_SIZE)
    .default(ANALYTICS_CONSTANTS.DEFAULT_PAGE_SIZE),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
